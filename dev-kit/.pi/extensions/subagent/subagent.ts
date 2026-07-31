import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeSubagent } from "./lib/modes.ts";
import { SubagentParams } from "./lib/schema.ts";
import type { SubagentParams as SubagentArguments } from "./lib/types.ts";

export default function subagentExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to fresh Pi processes with explicit permission profiles.",
			"Use single fields for one task, tasks for parallel work, or chain for sequential {previous} substitution.",
		].join(" "),
		parameters: SubagentParams as never,
		execute(_toolCallId, params, signal, onUpdate, ctx) {
			return executeSubagent(params as SubagentArguments, pi, signal, onUpdate, ctx);
		},
	});
}
