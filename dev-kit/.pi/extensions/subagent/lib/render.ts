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

const COMPACT_ITEM_COUNT = 8;
const COMPACT_ITEM_LENGTH = 512;
const COMPACT_ARGUMENT_LENGTH = 200;
const COMPACT_FIELD_LENGTH = 512;
const COMPACT_ARGUMENT_ENTRIES = 8;
const COMPACT_ARGUMENT_DEPTH = 4;

export function createRenderers(runtime?: RenderRuntime) {
	const getRuntime = () => runtime ?? loadRuntime();
	return {
		renderCall(args: any, theme: Theme) {
			const { Text } = getRuntime();
			return new Text(formatCall(args, theme), 0, 0);
		},
		renderResult(result: any, options: { expanded: boolean }, theme: Theme) {
			const resolvedRuntime = getRuntime();
			const details = result?.details;
			if (!isTaskResult(details)) return new resolvedRuntime.Text(modelVisibleContent(result), 0, 0);
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
	if (!expanded) {
		const { items, hasEarlierItems } = getRecentDisplayItems(result.messages, COMPACT_ITEM_COUNT);
		let text = `${header}\n${theme.fg("dim", preview(result.task, COMPACT_FIELD_LENGTH))}`;
		if (items.length === 0) text += `\n${theme.fg("muted", result.exitCode === -1 ? "(running...)" : "(no output)")}`;
		else text += `\n${renderCompactDisplayItems(items, hasEarlierItems, theme)}`;
		const diagnostics = formatDiagnostics(result, true);
		if (diagnostics.length > 0) text += `\n${theme.fg("error", diagnostics.join("\n"))}`;
		const usage = formatUsage(result.usage, result.model && preview(result.model, COMPACT_FIELD_LENGTH));
		if (usage) text += `\n${theme.fg("dim", usage)}`;
		return new runtime.Text(text, 0, 0);
	}

	const items = getDisplayItems(result.messages);
	const output = getFinalOutput(result.messages);
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

function formatDiagnostics(result: TaskResult, compact = false): string[] {
	if (result.exitCode === -1 || !isFailedResult(result)) return [];
	const detail = (text: string) => compact ? preview(text, COMPACT_FIELD_LENGTH) : text;
	const lines = [`Exit code: ${result.exitCode}`];
	if (result.stopReason) lines.push(`Stop reason: ${detail(result.stopReason)}`);
	if (result.errorMessage) lines.push(`Error: ${detail(result.errorMessage)}`);
	if (result.stderr.trim()) lines.push(`Stderr: ${detail(result.stderr.trim())}`);
	return lines;
}

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.content) {
			const item = displayItem(part);
			if (item) items.push(item);
		}
	}
	return items;
}

function getRecentDisplayItems(messages: Message[], limit: number): { items: DisplayItem[]; hasEarlierItems: boolean } {
	const items: DisplayItem[] = [];
	for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
		const message = messages[messageIndex];
		if (message.role !== "assistant") continue;
		for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
			const item = displayItem(message.content[partIndex]);
			if (!item) continue;
			if (items.length === limit) return { items: items.reverse(), hasEarlierItems: true };
			items.push(item);
		}
	}
	return { items: items.reverse(), hasEarlierItems: false };
}

function displayItem(part: any): DisplayItem | undefined {
	if (part.type === "text") return { type: "text", text: part.text };
	if (part.type === "toolCall") return { type: "toolCall", name: part.name, args: part.arguments };
	return undefined;
}

function renderCompactDisplayItems(items: DisplayItem[], hasEarlierItems: boolean, theme: Theme): string {
	const lines: string[] = [];
	if (hasEarlierItems) lines.push(theme.fg("muted", "… earlier items"));
	for (const item of items) {
		if (item.type === "toolCall") lines.push(`→ ${preview(formatToolCall(item.name, item.args, true), COMPACT_ITEM_LENGTH)}`);
		else lines.push(theme.fg("toolOutput", preview(item.text, COMPACT_ITEM_LENGTH)));
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

function formatToolCall(name: string, args: Record<string, unknown>, compact = false): string {
	const value = (argument: unknown, fallback: string) => formatToolArgument(argument ?? fallback, compact);
	if (name === "bash") return `$ ${value(args.command, "...")}`;
	if (name === "read") return `read ${value(args.file_path ?? args.path, "...")}`;
	if (name === "write") return `write ${value(args.file_path ?? args.path, "...")}`;
	if (name === "edit") return `edit ${value(args.file_path ?? args.path, "...")}`;
	if (name === "grep") return `grep /${value(args.pattern, "")}/ in ${value(args.path, ".")}`;
	if (name === "find") return `find ${value(args.pattern, "*")} in ${value(args.path, ".")}`;
	if (name === "ls") return `ls ${value(args.path, ".")}`;
	return `${name} ${compact ? formatCompactJson(args, COMPACT_ITEM_LENGTH - name.length - 1) : JSON.stringify(args)}`;
}

function formatToolArgument(value: unknown, compact: boolean): string {
	if (!compact) return String(value);
	if (typeof value === "string") return preview(value, COMPACT_ARGUMENT_LENGTH);
	try {
		return preview(String(value), COMPACT_ARGUMENT_LENGTH);
	} catch {
		return "(unavailable)";
	}
}

function formatCompactJson(value: unknown, maxLength: number): string {
	let text = "";
	let truncated = false;
	let exhausted = false;
	const seen = new Set<object>();
	const append = (next: string): boolean => {
		const remaining = maxLength - text.length;
		if (remaining <= 0) {
			truncated = true;
			exhausted = true;
			return false;
		}
		if (next.length > remaining) {
			text += next.slice(0, remaining);
			truncated = true;
			exhausted = true;
			return false;
		}
		text += next;
		return true;
	};
	const visit = (entry: unknown, depth: number): void => {
		if (exhausted) return;
		if (entry === null) {
			append("null");
			return;
		}
		if (typeof entry === "string") {
			const sample = entry.slice(0, COMPACT_ARGUMENT_LENGTH);
			append(JSON.stringify(sample));
			if (sample.length < entry.length) truncated = true;
			return;
		}
		if (typeof entry === "number" || typeof entry === "boolean") {
			append(String(entry));
			return;
		}
		if (typeof entry !== "object") {
			append(JSON.stringify(String(entry)));
			return;
		}
		if (seen.has(entry) || depth >= COMPACT_ARGUMENT_DEPTH) {
			truncated = true;
			append('"…"');
			return;
		}
		seen.add(entry);
		if (Array.isArray(entry)) {
			append("[");
			for (let index = 0; index < entry.length && index < COMPACT_ARGUMENT_ENTRIES && !exhausted; index += 1) {
				if (index > 0) append(",");
				visit(entry[index], depth + 1);
			}
			if (entry.length > COMPACT_ARGUMENT_ENTRIES && !exhausted) {
				truncated = true;
				append(",…");
			}
			append("]");
		} else {
			const record = entry as Record<string, unknown>;
			append("{");
			let count = 0;
			for (const key in record) {
				if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
				if (count === COMPACT_ARGUMENT_ENTRIES) {
					truncated = true;
					append(",…");
					break;
				}
				if (count > 0) append(",");
				append(JSON.stringify(key.slice(0, COMPACT_ARGUMENT_LENGTH)));
				append(":");
				visit(record[key], depth + 1);
				count += 1;
				if (exhausted) break;
			}
			append("}");
		}
		seen.delete(entry);
	};
	visit(value, 0);
	if (!truncated) return text;
	return text.length >= maxLength
		? `${text.slice(0, Math.max(0, maxLength - 1))}…`
		: `${text}…`;
}

function preview(text: string, maxLength: number): string {
	return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
}

function modelVisibleContent(result: any): string {
	if (!Array.isArray(result?.content)) return "(no output)";
	const text = result.content.find((part: unknown) => isRecord(part) && part.type === "text" && typeof part.text === "string");
	return isRecord(text) && typeof text.text === "string" ? text.text : "(no output)";
}

function isTaskResult(value: unknown): value is TaskResult {
	if (!isRecord(value) || !isUsageStats(value.usage) || !isRenderableMessages(value.messages)) return false;
	return typeof value.task === "string"
		&& (value.profile === "read-only" || value.profile === "write" || value.profile === "general")
		&& typeof value.cwd === "string"
		&& typeof value.exitCode === "number"
		&& typeof value.stderr === "string"
		&& (value.model === undefined || typeof value.model === "string")
		&& (value.stopReason === undefined || typeof value.stopReason === "string")
		&& (value.errorMessage === undefined || typeof value.errorMessage === "string");
}

function isUsageStats(value: unknown): value is UsageStats {
	if (!isRecord(value)) return false;
	return ["input", "output", "cacheRead", "cacheWrite", "cost", "contextTokens", "turns"].every(field => typeof value[field] === "number");
}

function isRenderableMessages(value: unknown): value is Message[] {
	return Array.isArray(value) && value.every(message => {
		if (!isRecord(message) || typeof message.role !== "string" || !Array.isArray(message.content)) return false;
		return message.content.every(part => {
			if (!isRecord(part) || typeof part.type !== "string") return false;
			if (part.type === "text") return typeof part.text === "string";
			if (part.type === "toolCall") return typeof part.name === "string" && isRecord(part.arguments);
			return true;
		});
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
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
