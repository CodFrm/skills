export const SubagentParams = {
	type: "object",
	properties: {
		task: { type: "string", description: "Complete task prompt" },
		profile: {
			type: "string",
			enum: ["read-only", "write", "general"],
			description: "Required permission profile",
		},
		model: { type: "string", description: "Optional real provider/model id; omitted or blank inherits the parent model" },
		thinking: { type: "string", description: "Optional Pi thinking level; omitted or blank inherits the parent level" },
		cwd: { type: "string", description: "Optional absolute or parent-cwd-relative directory; omitted or blank inherits the parent cwd" },
	},
	required: ["task", "profile"],
	additionalProperties: false,
} as const;
