import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatFailure, getFinalOutput, isFailedResult, runSingleTask } from "./invocation.ts";
import type { OnUpdate, SubagentDetails, SubagentParams, TaskResult } from "./types.ts";
import { validateTaskRequest } from "./validation.ts";

export async function executeSubagent(
	params: SubagentParams,
	pi: ExtensionAPI,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
	ctx: ExtensionContext,
): Promise<AgentToolResult<SubagentDetails>> {
	const validation = validateTaskRequest(params, pi, ctx);
	if (!validation.ok) return invalid(validation.error);

	const result = await runSingleTask(validation.request, ctx, signal, onUpdate);
	const details = makeDetails([result]);
	return isFailedResult(result)
		? { content: [{ type: "text", text: formatFailure(result) }], details, isError: true }
		: { content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }], details };
}

function invalid(error: string): AgentToolResult<SubagentDetails> {
	return {
		content: [{ type: "text", text: `Invalid subagent request: ${error}` }],
		details: makeDetails([]),
		isError: true,
	};
}

function makeDetails(results: TaskResult[]): SubagentDetails {
	return { mode: "single", results };
}
