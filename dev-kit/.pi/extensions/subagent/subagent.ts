import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeSubagent, SUBAGENT_CHILD_ENV } from "./lib/invocation.ts";
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
			return executeSubagent(params as SubagentArguments, pi, signal, onUpdate, ctx);
		},
		...renderers,
	});
}
