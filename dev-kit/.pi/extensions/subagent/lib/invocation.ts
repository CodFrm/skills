import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Message } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OnUpdate, ResolvedTaskRequest, SubagentDetails, TaskResult, UsageStats } from "./types.ts";

export async function runSingleTask(
	request: ResolvedTaskRequest,
	ctx: ExtensionContext,
	_signal: AbortSignal | undefined,
	onUpdate: OnUpdate | undefined,
): Promise<TaskResult> {
	const cwd = request.cwd;
	const args = ["--mode", "json", "-p", "--no-session"];
	if (request.model) args.push("--model", request.model);
	if (request.thinking) args.push("--thinking", request.thinking);
	args.push("--tools", request.tools.join(","));
	args.push(isTrustedChild(ctx, cwd) ? "--approve" : "--no-approve");

	const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-kit-subagent-"));
	const promptPath = path.join(promptDir, "system-prompt.md");
	fs.writeFileSync(promptPath, systemPrompt(request.profile), { encoding: "utf8", mode: 0o600 });
	args.push("--append-system-prompt", promptPath, `Task: ${request.task}`);

	const result: TaskResult = {
		task: request.task,
		profile: request.profile,
		cwd,
		exitCode: 0,
		messages: [],
		stderr: "",
		usage: emptyUsage(),
		model: request.model,
	};

	try {
		result.exitCode = await spawnAndCollect(args, cwd, result, onUpdate);
		return result;
	} finally {
		fs.rmSync(promptDir, { recursive: true, force: true });
	}
}

function spawnAndCollect(
	args: string[],
	cwd: string,
	result: TaskResult,
	onUpdate: OnUpdate | undefined,
): Promise<number> {
	return new Promise(resolve => {
		const invocation = getPiInvocation(args);
		const proc = spawn(invocation.command, invocation.args, {
			cwd,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let buffer = "";

		const processLine = (line: string) => {
			if (!line.trim()) return;
			let event: { type?: string; message?: Message };
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}
			if ((event.type === "message_end" || event.type === "tool_result_end") && event.message) {
				result.messages.push(event.message);
				if (event.type === "message_end" && event.message.role === "assistant") {
					result.usage.turns += 1;
					const usage = event.message.usage;
					if (usage) {
						result.usage.input += usage.input || 0;
						result.usage.output += usage.output || 0;
						result.usage.cacheRead += usage.cacheRead || 0;
						result.usage.cacheWrite += usage.cacheWrite || 0;
						result.usage.cost += usage.cost?.total || 0;
						result.usage.contextTokens = usage.totalTokens || 0;
					}
					if (event.message.model) result.model = event.message.model;
					if (event.message.stopReason) result.stopReason = event.message.stopReason;
					if (event.message.errorMessage) result.errorMessage = event.message.errorMessage;
				}
				onUpdate?.({
					content: [{ type: "text", text: getFinalOutput(result.messages) || "(running...)" }],
					details: makeDetails(result),
				});
			}
		};

		proc.stdout.on("data", data => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) processLine(line);
		});
		proc.stderr.on("data", data => {
			result.stderr += data.toString();
		});
		proc.on("close", code => {
			if (buffer.trim()) processLine(buffer);
			resolve(code ?? 0);
		});
		proc.on("error", error => {
			result.errorMessage = error.message;
			resolve(1);
		});
	});
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	return /^(node|bun)(\.exe)?$/.test(execName)
		? { command: "pi", args }
		: { command: process.execPath, args };
}

function isTrustedChild(ctx: ExtensionContext, cwd: string): boolean {
	if (!ctx.isProjectTrusted()) return false;
	const parent = fs.realpathSync(ctx.cwd);
	const relative = path.relative(parent, cwd);
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function systemPrompt(profile: ResolvedTaskRequest["profile"]): string {
	const lines = [
		"You are a dispatched subagent with an isolated context.",
		"When using-dev-kit is loaded, follow its subagent stop and execute only the assigned task.",
		"Do not ask the user questions. Follow the task's requested return format exactly.",
		"You must not invoke or delegate to subagent.",
		`Permission profile: ${profile}.`,
	];
	if (profile === "read-only") {
		lines.push(
			"You must not produce side effects or modify files.",
			"Use bash only for read-only inspection such as git diff, git show, and git log.",
		);
	}
	return lines.join("\n");
}

function getFinalOutput(messages: Message[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type === "text") return part.text;
		}
	}
	return "";
}

function makeDetails(result: TaskResult): SubagentDetails {
	return { mode: "single", results: [result] };
}

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

export { getFinalOutput };
