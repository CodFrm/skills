export const SubagentParams = {
	type: "object",
	properties: {
		task: { type: "string", description: "Complete task prompt" },
		profile: {
			type: "string",
			enum: ["read-only", "write", "general"],
			description: "Required permission profile",
		},
		model: { type: "string", description: "Optional real provider/model id" },
		thinking: { type: "string", description: "Optional Pi thinking level" },
		cwd: { type: "string", description: "Optional absolute or parent-cwd-relative directory" },
	},
	required: ["task", "profile"],
	additionalProperties: false,
} as const;
