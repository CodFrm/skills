import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SUBAGENT_CHILD_ENV } from "./lib/invocation.ts";
import { executeSubagent } from "./lib/modes.ts";
import { createRenderers } from "./lib/render.ts";
import { SubagentParams } from "./lib/schema.ts";
import type { SubagentParams as SubagentArguments } from "./lib/types.ts";

export default function subagentExtension(pi: ExtensionAPI) {
	if (process.env[SUBAGENT_CHILD_ENV]) return;

	const renderers = createRenderers();
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Delegate one task to a fresh Pi process with an explicit permission profile.",
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
