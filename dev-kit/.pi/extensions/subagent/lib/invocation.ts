import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OnUpdate, ResolvedTaskRequest, SubagentParams, TaskResult, UsageStats } from "./types.ts";
import { validateTaskRequest } from "./validation.ts";

export const SUBAGENT_CHILD_ENV = "DEV_KIT_PI_SUBAGENT_CHILD";

export async function executeSubagent(
	params: SubagentParams,
	pi: ExtensionAPI,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
	ctx: ExtensionContext,
): Promise<AgentToolResult<TaskResult>> {
	const validation = validateTaskRequest(params, pi, ctx);
	if (!validation.ok) throw new Error(`Invalid subagent request: ${validation.error}`);

	const result = await runSingleTask(validation.request, ctx, signal, onUpdate);
	return isFailedResult(result)
		? { content: [{ type: "text", text: formatFailure(result) }], details: result, isError: true }
		: { content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }], details: result };
}

export async function runSingleTask(
	request: ResolvedTaskRequest,
	ctx: ExtensionContext,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
): Promise<TaskResult> {
	const result = createResult(request);
	if (signal?.aborted) {
		markAborted(result);
		return result;
	}

	const args = ["--mode", "json", "-p", "--no-session"];
	if (request.model) args.push("--model", request.model);
	if (request.thinking) args.push("--thinking", request.thinking);
	args.push("--tools", request.tools.join(","));
	args.push(isTrustedChild(ctx, request.cwd) ? "--approve" : "--no-approve");

	const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-kit-subagent-"));
	const promptPath = path.join(promptDir, "system-prompt.md");
	fs.writeFileSync(promptPath, systemPrompt(request.profile), { encoding: "utf8", mode: 0o600 });
	args.push("--append-system-prompt", promptPath, `Task: ${request.task}`);

	try {
		result.exitCode = await spawnAndCollect(args, request.cwd, result, signal, onUpdate);
		finalizeFailureEvidence(result);
		return result;
	} finally {
		fs.rmSync(promptDir, { recursive: true, force: true });
	}
}

function spawnAndCollect(
	args: string[],
	cwd: string,
	result: TaskResult,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
): Promise<number> {
	return new Promise(resolve => {
		const invocation = getPiInvocation(args);
		let proc;
		try {
			proc = spawn(invocation.command, invocation.args, {
				cwd,
				env: { ...process.env, [SUBAGENT_CHILD_ENV]: "1" },
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (error) {
			result.errorMessage = error instanceof Error ? error.message : String(error);
			resolve(1);
			return;
		}

		let buffer = "";
		let settled = false;
		let wasAborted = false;
		let forceTimer: ReturnType<typeof setTimeout> | undefined;

		const finish = (code: number) => {
			if (settled) return;
			settled = true;
			if (forceTimer) clearTimeout(forceTimer);
			signal?.removeEventListener("abort", abortChild);
			if (wasAborted) markAborted(result);
			resolve(code);
		};

		const abortChild = () => {
			if (settled || wasAborted) return;
			wasAborted = true;
			proc.kill("SIGTERM");
			forceTimer = setTimeout(() => {
				if (!settled) proc.kill("SIGKILL");
			}, 5000);
			forceTimer.unref?.();
		};

		const processLine = (line: string) => {
			if (!line.trim()) return;
			let event: { type?: string; message?: Message };
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}
			if ((event.type === "message_end" || event.type === "tool_result_end") && event.message) {
				result.messages.push(event.message);
				if (event.type === "message_end" && event.message.role === "assistant") {
					result.usage.turns += 1;
					const usage = event.message.usage;
					if (usage) {
						result.usage.input += usage.input || 0;
						result.usage.output += usage.output || 0;
						result.usage.cacheRead += usage.cacheRead || 0;
						result.usage.cacheWrite += usage.cacheWrite || 0;
						result.usage.cost += usage.cost?.total || 0;
						result.usage.contextTokens = usage.totalTokens || 0;
					}
					if (event.message.model) result.model = event.message.model;
					if (event.message.stopReason) result.stopReason = event.message.stopReason;
					if (event.message.errorMessage) result.errorMessage = event.message.errorMessage;
				}
				onUpdate?.({
					content: [{ type: "text", text: getFinalOutput(result.messages) || "(running...)" }],
					details: result,
				});
			}
		};

		proc.stdout.on("data", data => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) processLine(line);
		});
		proc.stderr.on("data", data => {
			result.stderr += data.toString();
		});
		proc.on("close", (code, terminationSignal) => {
			if (buffer.trim()) processLine(buffer);
			if (code === null && terminationSignal && !wasAborted) {
				result.stopReason = "error";
				result.errorMessage ||= `Subagent terminated by ${terminationSignal}`;
				finish(1);
				return;
			}
			finish(code ?? 1);
		});
		proc.on("error", error => {
			result.errorMessage = error.message;
			finish(1);
		});

		if (signal?.aborted) abortChild();
		else signal?.addEventListener("abort", abortChild, { once: true });
	});
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	return /^(node|bun)(\.exe)?$/.test(execName)
		? { command: "pi", args }
		: { command: process.execPath, args };
}

function isTrustedChild(ctx: ExtensionContext, cwd: string): boolean {
	if (!ctx.isProjectTrusted()) return false;
	const parent = fs.realpathSync(ctx.cwd);
	const relative = path.relative(parent, cwd);
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function systemPrompt(profile: ResolvedTaskRequest["profile"]): string {
	const lines = [
		"You are a dispatched subagent. Execute only the assigned task; when using-dev-kit is loaded, obey its SUBAGENT-STOP.",
		"Do not ask the user. You must not invoke or delegate to subagent. Follow the requested return format exactly.",
		`Permission profile: ${profile}.`,
	];
	if (profile === "read-only") {
		lines.push(
			"You must not produce side effects or modify files.",
			"Use bash only for read-only inspection such as git diff, git show, and git log.",
		);
	}
	return lines.join("\n");
}

function createResult(request: ResolvedTaskRequest): TaskResult {
	return {
		task: request.task,
		profile: request.profile,
		cwd: request.cwd,
		exitCode: -1,
		messages: [],
		stderr: "",
		usage: emptyUsage(),
		model: request.model,
	};
}

function markAborted(result: TaskResult): void {
	if (result.exitCode <= 0) result.exitCode = 1;
	result.stopReason = "aborted";
	result.errorMessage = "Subagent was aborted";
}

function finalizeFailureEvidence(result: TaskResult): void {
	if (result.stopReason === "aborted") return;
	if (result.exitCode === 0 && result.stopReason !== "error") return;
	result.stopReason = "error";
	result.errorMessage ||= result.exitCode === 0
		? "Subagent reported an error"
		: `Subagent exited with code ${result.exitCode}`;
}

export function getFinalOutput(messages: Message[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") continue;
		for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
			const part = message.content[partIndex];
			if (part.type === "text") return part.text;
		}
	}
	return "";
}

export function isFailedResult(result: TaskResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

export function formatFailure(result: TaskResult): string {
	const lines = ["Subagent failed.", `Exit code: ${result.exitCode}`];
	if (result.stopReason) lines.push(`Stop reason: ${result.stopReason}`);
	if (result.errorMessage) lines.push(`Error: ${result.errorMessage}`);
	if (result.stderr.trim()) lines.push(`Stderr: ${result.stderr.trim()}`);
	const output = getFinalOutput(result.messages);
	if (output) lines.push(`Last output: ${output}`);
	return lines.join("\n");
}

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}
