import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Profile, ResolvedTaskRequest, SubagentParams } from "./types.ts";

const PUBLIC_FIELDS = new Set(["task", "profile", "model", "thinking", "cwd"]);
const PROFILE_TOOLS: Record<Exclude<Profile, "general">, string[]> = {
	"read-only": ["read", "bash", "grep", "find", "ls"],
	write: ["read", "bash", "edit", "write", "grep", "find", "ls"],
};
const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export type ValidationResult =
	| { ok: true; request: ResolvedTaskRequest }
	| { ok: false; error: string };

export function validateTaskRequest(
	params: SubagentParams,
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): ValidationResult {
	if (params === null || typeof params !== "object" || Array.isArray(params)) {
		return invalid("request", "must be an object");
	}

	const values = params as unknown as Record<string, unknown>;
	const unknownField = Object.keys(values).find(field => !PUBLIC_FIELDS.has(field));
	if (unknownField) return invalid(unknownField, "is not supported");

	const profile = values.profile;
	if (profile === undefined) return invalid("profile", "is required");
	if (profile !== "read-only" && profile !== "write" && profile !== "general") {
		return invalid("profile", 'must be "read-only", "write", or "general"');
	}

	const task = values.task;
	if (task === undefined) return invalid("task", "is required");
	if (typeof task !== "string" || task.trim().length === 0) return invalid("task", "must not be empty");

	const requestedCwd = omitBlankOptional(values.cwd);
	if (requestedCwd !== undefined && typeof requestedCwd !== "string") {
		return invalid("cwd", "must resolve to an existing directory");
	}
	let cwd: string;
	try {
		cwd = fs.realpathSync(path.resolve(ctx.cwd, requestedCwd ?? "."));
		if (!fs.statSync(cwd).isDirectory()) return invalid("cwd", "must resolve to an existing directory");
	} catch {
		return invalid("cwd", "must resolve to an existing directory");
	}

	const explicitModel = omitBlankOptional(values.model);
	if (
		explicitModel !== undefined
		&& (typeof explicitModel !== "string" || !/^[^/\s]+\/[^/\s]+(?:\/[^/\s]+)*$/.test(explicitModel))
	) {
		return invalid("model", "must be a real provider/model id");
	}
	const model = explicitModel ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined);

	const explicitThinking = omitBlankOptional(values.thinking);
	if (explicitThinking !== undefined && (typeof explicitThinking !== "string" || !THINKING_LEVELS.has(explicitThinking))) {
		return invalid("thinking", `must be one of ${Array.from(THINKING_LEVELS).join(", ")}`);
	}
	const thinking = explicitThinking ?? ctx.thinkingLevel;

	const selectedTools = profile === "general" ? pi.getActiveTools() : PROFILE_TOOLS[profile];
	if (profile === "general") {
		const commaTool = selectedTools.find(tool => tool.includes(","));
		if (commaTool) {
			return invalid("tools", `general profile cannot represent active tool ${JSON.stringify(commaTool)} because it contains a comma`);
		}
	}
	const tools: string[] = [];
	const seen = new Set<string>();
	for (const tool of selectedTools) {
		if (tool === "subagent" || seen.has(tool)) continue;
		seen.add(tool);
		tools.push(tool);
	}

	return {
		ok: true,
		request: { task, profile, cwd, model, thinking, tools },
	};
}

function omitBlankOptional(value: unknown): unknown {
	return typeof value === "string" && value.trim().length === 0 ? undefined : value;
}

function invalid(field: string, message: string): ValidationResult {
	return { ok: false, error: `${field}: ${message}.` };
}
