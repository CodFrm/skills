const TaskItem = {
	type: "object",
	properties: {
		task: { type: "string", description: "Complete task prompt" },
		profile: { type: "string", enum: ["write", "read-only"], description: "Required permission profile" },
		model: { type: "string", description: "Optional real provider/model id" },
		thinking: { type: "string", description: "Optional Pi thinking level" },
		tools: { type: "array", items: { type: "string" }, description: "Optional profile-bounded tool allowlist" },
		cwd: { type: "string", description: "Optional absolute or parent-cwd-relative directory" },
	},
	required: ["task", "profile"],
	additionalProperties: false,
} as const;

export const SubagentParams = {
	type: "object",
	properties: {
		...TaskItem.properties,
		tasks: { type: "array", items: TaskItem, description: "Independent tasks for parallel mode" },
		chain: { type: "array", items: TaskItem, description: "Sequential tasks with optional {previous} substitution" },
	},
	additionalProperties: false,
} as const;
