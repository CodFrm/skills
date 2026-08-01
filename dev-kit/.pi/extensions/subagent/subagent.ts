import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeSubagent } from "./lib/modes.ts";
import { createRenderers } from "./lib/render.ts";
import { SubagentParams } from "./lib/schema.ts";
import type { SubagentParams as SubagentArguments } from "./lib/types.ts";

export default function subagentExtension(pi: ExtensionAPI) {
	const renderers = createRenderers();
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to fresh Pi processes with explicit permission profiles.",
			"Use single fields by default, tasks only for gate-approved parallel work, or chain for sequential {previous} substitution.",
		].join(" "),
		parameters: SubagentParams as never,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const result = await executeSubagent(params as SubagentArguments, pi, signal, onUpdate, ctx);
			if (result.isError && result.details.results.length === 0) {
				const message = result.content[0]?.type === "text" ? result.content[0].text : "Invalid subagent request.";
				throw new Error(message);
			}
			return result;
		},
		...renderers,
	});
}
