import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";

export type Profile = "write" | "read-only";

export interface TaskRequest {
	task: string;
	profile: Profile;
	model?: string;
	thinking?: string;
	tools?: string[];
	cwd?: string;
}

export interface ResolvedTaskRequest extends TaskRequest {
	cwd: string;
	tools: string[];
}

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

export interface TaskResult {
	task: string;
	profile: Profile;
	cwd: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
}

export interface SubagentDetails {
	mode: "single" | "parallel" | "chain";
	results: TaskResult[];
}

export type OnUpdate = (partial: AgentToolResult<SubagentDetails>) => void;
