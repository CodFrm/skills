import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Profile, ResolvedTaskRequest, TaskRequest } from "./types.ts";

const PROFILE_TOOLS: Record<Profile, string[]> = {
	write: ["read", "bash", "edit", "write", "grep", "find", "ls"],
	"read-only": ["read", "bash", "grep", "find", "ls"],
};
const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export type ValidationResult =
	| { ok: true; request: ResolvedTaskRequest }
	| { ok: false; error: string };

export function validateSingleRequest(
	params: TaskRequest,
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): ValidationResult {
	if (params.profile !== "write" && params.profile !== "read-only") {
		return invalid("profile", 'must be "write" or "read-only"');
	}
	if (typeof params.task !== "string" || params.task.trim().length === 0) {
		return invalid("task", "must not be empty");
	}

	let cwd: string;
	try {
		cwd = fs.realpathSync(path.resolve(ctx.cwd, params.cwd ?? "."));
		if (!fs.statSync(cwd).isDirectory()) return invalid("cwd", "must resolve to an existing directory");
	} catch {
		return invalid("cwd", "must resolve to an existing directory");
	}

	const explicitModel = params.model;
	if (explicitModel !== undefined && !/^[^/\s]+\/[^/\s]+$/.test(explicitModel)) {
		return invalid("model", "must be a real provider/model id");
	}
	const model = explicitModel ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined);

	if (params.thinking !== undefined && !THINKING_LEVELS.has(params.thinking)) {
		return invalid("thinking", `must be one of ${Array.from(THINKING_LEVELS).join(", ")}`);
	}
	const thinking = params.thinking ?? ctx.thinkingLevel;

	const tools = params.tools ?? PROFILE_TOOLS[params.profile];
	if (!Array.isArray(tools) || tools.some(tool => typeof tool !== "string" || tool.length === 0)) {
		return invalid("tools", "must be an array of non-empty tool names");
	}
	if (tools.includes("subagent")) return invalid("tools", "must not include subagent");

	if (params.profile === "read-only") {
		const outsideProfile = tools.find(tool => !PROFILE_TOOLS["read-only"].includes(tool));
		if (outsideProfile) return invalid("tools", `${outsideProfile} is outside the read-only profile`);
	} else {
		const available = new Set(pi.getAllTools().map(tool => tool.name));
		const unknown = tools.find(tool => !available.has(tool));
		if (unknown) return invalid("tools", `${unknown} is not loaded in the current Pi session`);
	}

	return {
		ok: true,
		request: { ...params, profile: params.profile, task: params.task, cwd, model, thinking, tools },
	};
}

function invalid(field: string, message: string): ValidationResult {
	return { ok: false, error: `Invalid subagent request: ${field}: ${message}.` };
}
