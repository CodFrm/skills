import * as fs from "node:fs";
import { createRequire } from "node:module";
import type { Message } from "@earendil-works/pi-ai";
import { getFinalOutput, isFailedResult } from "./invocation.ts";
import type { SubagentDetails, TaskResult, UsageStats } from "./types.ts";

const COLLAPSED_ITEM_COUNT = 10;

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
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const content = result.content?.find((part: any) => part.type === "text")?.text ?? "(no output)";
				return new resolvedRuntime.Text(content, 0, 0);
			}
			if (details.mode === "single") {
				return renderSingle(details.results[0], options.expanded, theme, resolvedRuntime);
			}
			if (details.mode === "parallel") {
				return renderParallel(details.results, options.expanded, theme, resolvedRuntime);
			}
			return renderChain(details.results, options.expanded, theme, resolvedRuntime);
		},
	};
}

function formatCall(args: any, theme: Theme): string {
	if (Array.isArray(args.chain)) {
		let text = `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", `chain (${args.chain.length} steps)`)}`;
		for (const [index, step] of args.chain.slice(0, 3).entries()) {
			text += `\n  ${index + 1}. ${theme.fg("accent", step.profile)} ${theme.fg("dim", preview(step.task, 40))}`;
		}
		if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
		return text;
	}
	if (Array.isArray(args.tasks)) {
		let text = `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", `parallel (${args.tasks.length} tasks)`)}`;
		for (const task of args.tasks.slice(0, 3)) {
			text += `\n  ${theme.fg("accent", task.profile)} ${theme.fg("dim", preview(task.task, 40))}`;
		}
		if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
		return text;
	}
	return `${theme.fg("toolTitle", theme.bold("subagent "))}${theme.fg("accent", args.profile ?? "...")}\n  ${theme.fg("dim", preview(args.task ?? "...", 60))}`;
}

function renderSingle(result: TaskResult, expanded: boolean, theme: Theme, runtime: RenderRuntime): Component {
	const icon = result.exitCode === -1
		? theme.fg("warning", "⏳")
		: isFailedResult(result)
			? theme.fg("error", "✗")
			: theme.fg("success", "✓");
	const header = `${icon} ${theme.fg("toolTitle", theme.bold(result.profile))}`;
	const items = getDisplayItems(result.messages);
	const output = getFinalOutput(result.messages);
	if (!expanded) {
		let text = header;
		if (result.errorMessage) text += `\n${theme.fg("error", result.errorMessage)}`;
		if (items.length === 0) text += `\n${theme.fg("muted", result.exitCode === -1 ? "(running...)" : "(no output)")}`;
		else text += `\n${renderDisplayItems(items, theme, COLLAPSED_ITEM_COUNT)}`;
		const usage = formatUsage(result.usage, result.model);
		if (usage) text += `\n${theme.fg("dim", usage)}`;
		if (items.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
		return new runtime.Text(text, 0, 0);
	}

	const container = new runtime.Container();
	container.addChild(new runtime.Text(header, 0, 0));
	if (result.errorMessage) container.addChild(new runtime.Text(theme.fg("error", `Error: ${result.errorMessage}`), 0, 0));
	container.addChild(new runtime.Spacer(1));
	container.addChild(new runtime.Text(theme.fg("muted", "─── Task ───"), 0, 0));
	container.addChild(new runtime.Text(theme.fg("dim", result.task), 0, 0));
	container.addChild(new runtime.Spacer(1));
	container.addChild(new runtime.Text(theme.fg("muted", "─── Output ───"), 0, 0));
	addToolCalls(container, items, theme, runtime);
	if (output) container.addChild(new runtime.Markdown(output.trim(), 0, 0, markdownTheme(theme)));
	else container.addChild(new runtime.Text(theme.fg("muted", "(no output)"), 0, 0));
	const usage = formatUsage(result.usage, result.model);
	if (usage) {
		container.addChild(new runtime.Spacer(1));
		container.addChild(new runtime.Text(theme.fg("dim", usage), 0, 0));
	}
	return container;
}

function renderParallel(results: TaskResult[], expanded: boolean, theme: Theme, runtime: RenderRuntime): Component {
	const running = results.filter(result => result.exitCode === -1).length;
	const succeeded = results.filter(result => result.exitCode !== -1 && !isFailedResult(result)).length;
	const failed = results.filter(result => result.exitCode !== -1 && isFailedResult(result)).length;
	const icon = running > 0 ? theme.fg("warning", "⏳") : failed > 0 ? theme.fg("warning", "◐") : theme.fg("success", "✓");
	const status = running > 0 ? `${succeeded + failed}/${results.length} done, ${running} running` : `${succeeded}/${results.length} tasks`;
	return renderMany("parallel", results, icon, status, expanded, theme, runtime);
}

function renderChain(results: TaskResult[], expanded: boolean, theme: Theme, runtime: RenderRuntime): Component {
	const succeeded = results.filter(result => !isFailedResult(result)).length;
	const icon = succeeded === results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");
	return renderMany("chain", results, icon, `${succeeded}/${results.length} steps`, expanded, theme, runtime);
}

function renderMany(
	mode: "parallel" | "chain",
	results: TaskResult[],
	icon: string,
	status: string,
	expanded: boolean,
	theme: Theme,
	runtime: RenderRuntime,
): Component {
	const title = `${icon} ${theme.fg("toolTitle", theme.bold(`${mode} `))}${theme.fg("accent", status)}`;
	if (!expanded) {
		let text = title;
		for (const [index, result] of results.entries()) {
			const resultIcon = result.exitCode === -1 ? "⏳" : isFailedResult(result) ? "✗" : "✓";
			const label = mode === "chain" ? `Step ${result.step ?? index + 1}` : `Task ${index + 1}`;
			text += `\n\n─── ${label} [${result.profile}] ${resultIcon}`;
			if (result.errorMessage) text += `\n${theme.fg("error", result.errorMessage)}`;
			else {
				const items = getDisplayItems(result.messages);
				text += items.length > 0
					? `\n${renderDisplayItems(items, theme, 5)}`
					: `\n${theme.fg("muted", result.exitCode === -1 ? "(running...)" : "(no output)")}`;
			}
		}
		if (results.every(result => result.exitCode !== -1)) {
			const usage = formatUsage(aggregateUsage(results));
			if (usage) text += `\n\n${theme.fg("dim", `Total: ${usage}`)}`;
		}
		text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
		return new runtime.Text(text, 0, 0);
	}

	const container = new runtime.Container();
	container.addChild(new runtime.Text(title, 0, 0));
	for (const [index, result] of results.entries()) {
		const resultIcon = result.exitCode === -1 ? "⏳" : isFailedResult(result) ? "✗" : "✓";
		const label = mode === "chain" ? `Step ${result.step ?? index + 1}` : `Task ${index + 1}`;
		container.addChild(new runtime.Spacer(1));
		container.addChild(new runtime.Text(`─── ${label} [${result.profile}] ${resultIcon}`, 0, 0));
		container.addChild(new runtime.Text(`Task: ${result.task}`, 0, 0));
		if (result.errorMessage) container.addChild(new runtime.Text(theme.fg("error", `Error: ${result.errorMessage}`), 0, 0));
		const items = getDisplayItems(result.messages);
		addToolCalls(container, items, theme, runtime);
		const output = getFinalOutput(result.messages);
		if (output) container.addChild(new runtime.Markdown(output.trim(), 0, 0, markdownTheme(theme)));
		const usage = formatUsage(result.usage, result.model);
		if (usage) container.addChild(new runtime.Text(theme.fg("dim", usage), 0, 0));
	}
	const usage = formatUsage(aggregateUsage(results));
	if (usage) {
		container.addChild(new runtime.Spacer(1));
		container.addChild(new runtime.Text(theme.fg("dim", `Total: ${usage}`), 0, 0));
	}
	return container;
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

function renderDisplayItems(items: DisplayItem[], theme: Theme, limit: number): string {
	const shown = items.slice(-limit);
	const lines: string[] = [];
	if (items.length > limit) lines.push(theme.fg("muted", `... ${items.length - limit} earlier items`));
	for (const item of shown) {
		if (item.type === "toolCall") lines.push(`→ ${formatToolCall(item.name, item.args)}`);
		else lines.push(theme.fg("toolOutput", item.text.split("\n").slice(0, 3).join("\n")));
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
	return `${name} ${preview(JSON.stringify(args), 50)}`;
}

function aggregateUsage(results: TaskResult[]): UsageStats {
	return results.reduce<UsageStats>((total, result) => ({
		input: total.input + result.usage.input,
		output: total.output + result.usage.output,
		cacheRead: total.cacheRead + result.usage.cacheRead,
		cacheWrite: total.cacheWrite + result.usage.cacheWrite,
		cost: total.cost + result.usage.cost,
		contextTokens: 0,
		turns: total.turns + result.usage.turns,
	}), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 });
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

function preview(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}...` : text;
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
