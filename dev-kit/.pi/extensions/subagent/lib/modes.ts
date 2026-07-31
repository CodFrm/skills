import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	formatFailure,
	getFinalOutput,
	getResultOutput,
	isFailedResult,
	runSingleTask,
} from "./invocation.ts";
import type {
	OnUpdate,
	ResolvedTaskRequest,
	SubagentDetails,
	SubagentParams,
	TaskRequest,
	TaskResult,
} from "./types.ts";
import { validateTaskRequest } from "./validation.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const PER_TASK_OUTPUT_CAP = 50 * 1024;

type Mode = SubagentDetails["mode"];

export async function executeSubagent(
	params: SubagentParams,
	pi: ExtensionAPI,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
	ctx: ExtensionContext,
): Promise<AgentToolResult<SubagentDetails>> {
	const mode = selectMode(params);
	if (!mode.ok) return invalid(mode.error);

	if (mode.mode === "single") {
		const validation = validateTaskRequest(params as TaskRequest, pi, ctx);
		if (!validation.ok) return invalid(validation.error, "single");
		const result = await runSingleTask(validation.request, ctx, signal, onUpdate);
		const details = makeDetails("single", [result]);
		return isFailedResult(result)
			? { content: [{ type: "text", text: formatFailure(result) }], details, isError: true }
			: { content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }], details };
	}

	const items = params[mode.mode === "parallel" ? "tasks" : "chain"] as TaskRequest[];
	if (items.length === 0) return invalid(`${mode.mode === "parallel" ? "tasks" : "chain"}: must not be empty.`, mode.mode);
	if (mode.mode === "parallel" && items.length > MAX_PARALLEL_TASKS) {
		return invalid(`tasks: must contain at most ${MAX_PARALLEL_TASKS} tasks.`, "parallel");
	}

	const validation = validateAll(items, mode.mode === "parallel" ? "tasks" : "chain", pi, ctx);
	if (!validation.ok) return invalid(validation.error, mode.mode);
	return mode.mode === "parallel"
		? runParallel(validation.requests, ctx, signal, onUpdate)
		: runChain(validation.requests, ctx, signal, onUpdate);
}

function selectMode(params: SubagentParams): { ok: true; mode: Mode } | { ok: false; error: string } {
	const singleKeys: Array<keyof TaskRequest> = ["task", "profile", "model", "thinking", "tools", "cwd"];
	const hasSingle = singleKeys.some(key => params[key] !== undefined);
	const hasParallel = params.tasks !== undefined;
	const hasChain = params.chain !== undefined;
	const count = Number(hasSingle) + Number(hasParallel) + Number(hasChain);
	if (count !== 1) return { ok: false, error: "Provide exactly one mode: single fields, tasks, or chain." };
	return { ok: true, mode: hasParallel ? "parallel" : hasChain ? "chain" : "single" };
}

function validateAll(
	items: TaskRequest[],
	field: "tasks" | "chain",
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): { ok: true; requests: ResolvedTaskRequest[] } | { ok: false; error: string } {
	const requests: ResolvedTaskRequest[] = [];
	for (let index = 0; index < items.length; index += 1) {
		const validation = validateTaskRequest(items[index], pi, ctx, `${field}[${index}].`);
		if (!validation.ok) return validation;
		requests.push(validation.request);
	}
	return { ok: true, requests };
}

async function runParallel(
	requests: ResolvedTaskRequest[],
	ctx: ExtensionContext,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
): Promise<AgentToolResult<SubagentDetails>> {
	const allResults = requests.map(pendingResult);
	const emitUpdate = () => {
		if (!onUpdate) return;
		const done = allResults.filter(result => result.exitCode !== -1).length;
		onUpdate({
			content: [{ type: "text", text: `Parallel: ${done}/${allResults.length} done` }],
			details: makeDetails("parallel", [...allResults]),
		});
	};

	const results = await mapWithConcurrencyLimit(requests, MAX_CONCURRENCY, async (request, index) => {
		const result = await runSingleTask(request, ctx, signal, partial => {
			const current = partial.details?.results[0];
			if (current) {
				allResults[index] = current;
				emitUpdate();
			}
		});
		allResults[index] = result;
		emitUpdate();
		return result;
	});

	const successCount = results.filter(result => !isFailedResult(result)).length;
	const summaries = results.map((result, index) => {
		const status = isFailedResult(result)
			? `failed${result.stopReason ? ` (${result.stopReason})` : ""}`
			: "completed";
		return `### Task ${index + 1} [${result.profile}] ${status}\n\n${truncateParentOutput(getResultOutput(result))}`;
	});
	return {
		content: [{ type: "text", text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}` }],
		details: makeDetails("parallel", results),
	};
}

async function runChain(
	requests: ResolvedTaskRequest[],
	ctx: ExtensionContext,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
): Promise<AgentToolResult<SubagentDetails>> {
	const results: TaskResult[] = [];
	let previous = "";
	for (let index = 0; index < requests.length; index += 1) {
		const request = { ...requests[index], task: requests[index].task.replace(/\{previous\}/g, previous) };
		const result = await runSingleTask(request, ctx, signal, partial => {
			const current = partial.details?.results[0];
			if (current) onUpdate?.({ content: partial.content, details: makeDetails("chain", [...results, current]) });
		});
		result.step = index + 1;
		results.push(result);
		if (isFailedResult(result)) {
			return {
				content: [{ type: "text", text: `Chain stopped at step ${index + 1}: ${formatFailure(result)}` }],
				details: makeDetails("chain", results),
				isError: true,
			};
		}
		previous = getFinalOutput(result.messages);
	}
	return {
		content: [{ type: "text", text: getFinalOutput(results.at(-1)?.messages ?? []) || "(no output)" }],
		details: makeDetails("chain", results),
	};
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= items.length) return;
			results[index] = await fn(items[index], index);
		}
	});
	await Promise.all(workers);
	return results;
}

function pendingResult(request: ResolvedTaskRequest): TaskResult {
	return {
		task: request.task,
		profile: request.profile,
		cwd: request.cwd,
		exitCode: -1,
		messages: [],
		stderr: "",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
		model: request.model,
	};
}

function invalid(error: string, mode: Mode = "single"): AgentToolResult<SubagentDetails> {
	return {
		content: [{ type: "text", text: `Invalid subagent request: ${error}` }],
		details: makeDetails(mode, []),
		isError: true,
	};
}

function makeDetails(mode: Mode, results: TaskResult[]): SubagentDetails {
	return { mode, results };
}

function truncateParentOutput(output: string): string {
	const byteLength = Buffer.byteLength(output, "utf8");
	if (byteLength <= PER_TASK_OUTPUT_CAP) return output;
	let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
	while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
		truncated = truncated.slice(0, -1);
	}
	const omitted = byteLength - Buffer.byteLength(truncated, "utf8");
	return `${truncated}\n\n[Output truncated: ${omitted} bytes omitted. Full output preserved in tool details.]`;
}
