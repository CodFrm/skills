import * as fs from "node:fs";
import { createRequire } from "node:module";
import type { Message } from "@earendil-works/pi-ai";
import { getFinalOutput, isFailedResult } from "./invocation.ts";
import type { TaskResult, UsageStats } from "./types.ts";

interface Component {
	render(width: number): string[];
	invalidate(): void;
}

interface ContainerComponent extends Component {
	addChild(component: Component): void;
}

interface RenderRuntime {
	Text: new (text?: string, paddingX?: number, paddingY?: number) => Component;
	Container: new () => ContainerComponent;
	Spacer: new (lines?: number) => Component;
	Markdown: new (text: string, paddingX: number, paddingY: number, theme: MarkdownTheme) => Component;
}

interface Theme {
	fg(color: string, text: string): string;
	bold(text: string): string;
	italic(text: string): string;
	underline(text: string): string;
}

interface MarkdownTheme {
	heading(text: string): string;
	link(text: string): string;
	linkUrl(text: string): string;
	code(text: string): string;
	codeBlock(text: string): string;
	codeBlockBorder(text: string): string;
	quote(text: string): string;
	quoteBorder(text: string): string;
	hr(text: string): string;
	listBullet(text: string): string;
	bold(text: string): string;
	italic(text: string): string;
	underline(text: string): string;
	strikethrough(text: string): string;
	highlightCode(code: string): string[];
}

type DisplayItem =
	| { type: "text"; text: string }
	| { type: "toolCall"; name: string; args: Record<string, unknown> };

export function createRenderers(runtime?: RenderRuntime) {
	const getRuntime = () => runtime ?? loadRuntime();
	return {
		renderCall(args: any, theme: Theme) {
			const { Text } = getRuntime();
			return new Text(formatCall(args, theme), 0, 0);
		},
		renderResult(result: any, options: { expanded: boolean }, theme: Theme) {
			const resolvedRuntime = getRuntime();
			const details = result.details as TaskResult | undefined;
			if (!details) {
				const content = result.content?.find((part: any) => part.type === "text")?.text ?? "(no output)";
				return new resolvedRuntime.Text(content, 0, 0);
			}
			return renderTask(details, options.expanded, theme, resolvedRuntime);
		},
	};
}

function formatCall(args: any, theme: Theme): string {
	return `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.profile ?? "...")}\n  ${theme.fg("dim", args.task ?? "...")}`;
}

function renderTask(result: TaskResult, expanded: boolean, theme: Theme, runtime: RenderRuntime): Component {
	const icon = result.exitCode === -1
		? theme.fg("warning", "⏳")
		: isFailedResult(result)
			? theme.fg("error", "✗")
			: theme.fg("success", "✓");
	const header = `${icon} ${theme.fg("toolTitle", theme.bold(result.profile))}`;
	const items = getDisplayItems(result.messages);
	const output = getFinalOutput(result.messages);
	if (!expanded) {
		let text = `${header}\n${theme.fg("dim", result.task)}`;
		if (items.length === 0) text += `\n${theme.fg("muted", result.exitCode === -1 ? "(running...)" : "(no output)")}`;
		else text += `\n${renderDisplayItems(items, theme)}`;
		const diagnostics = formatDiagnostics(result);
		if (diagnostics.length > 0) text += `\n${theme.fg("error", diagnostics.join("\n"))}`;
		const usage = formatUsage(result.usage, result.model);
		if (usage) text += `\n${theme.fg("dim", usage)}`;
		return new runtime.Text(text, 0, 0);
	}

	const container = new runtime.Container();
	container.addChild(new runtime.Text(header, 0, 0));
	container.addChild(new runtime.Spacer(1));
	container.addChild(new runtime.Text(theme.fg("muted", "─── Task ───"), 0, 0));
	container.addChild(new runtime.Text(theme.fg("dim", result.task), 0, 0));
	container.addChild(new runtime.Spacer(1));
	container.addChild(new runtime.Text(theme.fg("muted", "─── Output ───"), 0, 0));
	addToolCalls(container, items, theme, runtime);
	if (output) container.addChild(new runtime.Markdown(output, 0, 0, markdownTheme(theme)));
	else container.addChild(new runtime.Text(theme.fg("muted", result.exitCode === -1 ? "(running...)" : "(no output)"), 0, 0));
	const diagnostics = formatDiagnostics(result);
	if (diagnostics.length > 0) {
		container.addChild(new runtime.Spacer(1));
		container.addChild(new runtime.Text(theme.fg("muted", "─── Diagnostics ───"), 0, 0));
		container.addChild(new runtime.Text(theme.fg("error", diagnostics.join("\n")), 0, 0));
	}
	const usage = formatUsage(result.usage, result.model);
	if (usage) {
		container.addChild(new runtime.Spacer(1));
		container.addChild(new runtime.Text(theme.fg("dim", usage), 0, 0));
	}
	return container;
}

function formatDiagnostics(result: TaskResult): string[] {
	if (result.exitCode === -1 || !isFailedResult(result)) return [];
	const lines = [`Exit code: ${result.exitCode}`];
	if (result.stopReason) lines.push(`Stop reason: ${result.stopReason}`);
	if (result.errorMessage) lines.push(`Error: ${result.errorMessage}`);
	if (result.stderr.trim()) lines.push(`Stderr: ${result.stderr.trim()}`);
	return lines;
}

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			if (part.type === "text") items.push({ type: "text", text: part.text });
			else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
		}
	}
	return items;
}

function renderDisplayItems(items: DisplayItem[], theme: Theme): string {
	const lines: string[] = [];
	for (const item of items) {
		if (item.type === "toolCall") lines.push(`→ ${formatToolCall(item.name, item.args)}`);
		else lines.push(theme.fg("toolOutput", item.text));
	}
	return lines.join("\n");
}

function addToolCalls(container: ContainerComponent, items: DisplayItem[], theme: Theme, runtime: RenderRuntime): void {
	for (const item of items) {
		if (item.type === "toolCall") {
			container.addChild(new runtime.Text(theme.fg("muted", `→ ${formatToolCall(item.name, item.args)}`), 0, 0));
		}
	}
}

function formatToolCall(name: string, args: Record<string, unknown>): string {
	if (name === "bash") return `$ ${String(args.command ?? "...")}`;
	if (name === "read") return `read ${String(args.file_path ?? args.path ?? "...")}`;
	if (name === "write") return `write ${String(args.file_path ?? args.path ?? "...")}`;
	if (name === "edit") return `edit ${String(args.file_path ?? args.path ?? "...")}`;
	if (name === "grep") return `grep /${String(args.pattern ?? "")}/ in ${String(args.path ?? ".")}`;
	if (name === "find") return `find ${String(args.pattern ?? "*")} in ${String(args.path ?? ".")}`;
	if (name === "ls") return `ls ${String(args.path ?? ".")}`;
	return `${name} ${JSON.stringify(args)}`;
}

function formatUsage(usage: UsageStats, model?: string): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens) parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatTokens(count: number): string {
	if (count < 1000) return String(count);
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function markdownTheme(theme: Theme): MarkdownTheme {
	return {
		heading: text => theme.fg("mdHeading", text),
		link: text => theme.fg("mdLink", text),
		linkUrl: text => theme.fg("mdLinkUrl", text),
		code: text => theme.fg("mdCode", text),
		codeBlock: text => theme.fg("mdCodeBlock", text),
		codeBlockBorder: text => theme.fg("mdCodeBlockBorder", text),
		quote: text => theme.fg("mdQuote", text),
		quoteBorder: text => theme.fg("mdQuoteBorder", text),
		hr: text => theme.fg("mdHr", text),
		listBullet: text => theme.fg("mdListBullet", text),
		bold: text => theme.bold(text),
		italic: text => theme.italic(text),
		underline: text => theme.underline(text),
		strikethrough: text => text,
		highlightCode: code => code.split("\n").map(line => theme.fg("mdCodeBlock", line)),
	};
}

function loadRuntime(): RenderRuntime {
	const anchors = [import.meta.url];
	if (process.argv[1] && fs.existsSync(process.argv[1])) anchors.push(fs.realpathSync(process.argv[1]));
	for (const anchor of anchors) {
		try {
			return createRequire(anchor)("@earendil-works/pi-tui") as RenderRuntime;
		} catch {
			// Try the next runtime anchor.
		}
	}
	throw new Error("Unable to resolve @earendil-works/pi-tui for subagent rendering.");
}
