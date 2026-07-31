import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getFinalOutput, runSingleTask } from "./lib/invocation.ts";
import type { TaskRequest, TaskResult } from "./lib/types.ts";
import { validateSingleRequest } from "./lib/validation.ts";

const SubagentParams = {
	type: "object",
	properties: {
		task: { type: "string", description: "Complete task prompt for single mode" },
		profile: { type: "string", enum: ["write", "read-only"], description: "Required permission profile" },
		model: { type: "string", description: "Optional real provider/model id" },
		thinking: { type: "string", description: "Optional Pi thinking level" },
		tools: { type: "array", items: { type: "string" }, description: "Optional profile-bounded tool allowlist" },
		cwd: { type: "string", description: "Optional absolute or parent-cwd-relative directory" },
	},
	required: ["task", "profile"],
	additionalProperties: false,
} as const;

export default function subagentExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Delegate one task to a fresh Pi process with an explicit permission profile.",
		parameters: SubagentParams as never,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const validation = validateSingleRequest(params as TaskRequest, pi, ctx);
			if (!validation.ok) {
				return {
					content: [{ type: "text", text: validation.error }],
					details: { mode: "single" as const, results: [] },
					isError: true,
				};
			}

			const result = await runSingleTask(validation.request, ctx, signal, onUpdate);
			const details = { mode: "single" as const, results: [result] };
			if (isFailedResult(result)) {
				return {
					content: [{ type: "text", text: formatFailure(result) }],
					details,
					isError: true,
				};
			}
			return {
				content: [{ type: "text", text: getFinalOutput(result.messages) || "(no output)" }],
				details,
			};
		},
	});
}

function isFailedResult(result: TaskResult): boolean {
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

function formatFailure(result: TaskResult): string {
	const lines = ["Subagent failed.", `Exit code: ${result.exitCode}`];
	if (result.stopReason) lines.push(`Stop reason: ${result.stopReason}`);
	if (result.errorMessage) lines.push(`Error: ${result.errorMessage}`);
	if (result.stderr.trim()) lines.push(`Stderr: ${result.stderr.trim()}`);
	const output = getFinalOutput(result.messages);
	if (output) lines.push(`Last output: ${output}`);
	return lines.join("\n");
}
