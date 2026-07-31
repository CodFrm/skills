// Pi adapter: inject using-dev-kit into every model context so later user runs and
// post-compaction turns keep the same guidance. package.json exposes the canonical skill bodies
// under ../../skills, so this extension does not rediscover them or bypass package filters.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const IMPORTANT_MARKER = "<EXTREMELY_IMPORTANT>";
const BOOTSTRAP_MARKER = "dev-kit:using-dev-kit bootstrap for pi";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const skillsDir = resolve(packageRoot, "skills");
const bootstrapPath = resolve(skillsDir, "using-dev-kit", "SKILL.md");
const piToolsPath = resolve(skillsDir, "using-dev-kit", "references", "pi-tools.md");
const devkitBinPath = resolve(packageRoot, "bin", "devkit");

let cachedBootstrap: string | null | undefined;

export default function devKitPiExtension(pi: ExtensionAPI) {
	pi.on("context", async (event) => {
		if (event.messages.some(messageContainsBootstrap)) return;

		const bootstrap = getBootstrapContent();
		if (!bootstrap) return;

		const bootstrapMessage = {
			role: "user" as const,
			content: [{ type: "text" as const, text: bootstrap }],
			timestamp: Date.now(),
		};
		const insertAt = firstNonCompactionSummaryIndex(event.messages);

		return {
			messages: [
				...event.messages.slice(0, insertAt),
				bootstrapMessage,
				...event.messages.slice(insertAt),
			],
		};
	});
}

function getBootstrapContent(): string | null {
	if (cachedBootstrap !== undefined) return cachedBootstrap;

	try {
		const bootstrapBody = stripFrontmatter(readFileSync(bootstrapPath, "utf8"));
		const piTools = readFileSync(piToolsPath, "utf8").trim();
		const cli = existsSync(devkitBinPath)
			? `\n\n<DEV-KIT-CLI>\nWherever a skill writes \`devkit <subcommand>\`, try \`command -v devkit\` first; if that fails, use \`node "${devkitBinPath}" <subcommand>\`.\n</DEV-KIT-CLI>`
			: "";

		cachedBootstrap = `${IMPORTANT_MARKER}
${BOOTSTRAP_MARKER}

You have loaded dev-kit.

The using-dev-kit content and Pi tool mapping are included below and are already loaded for this session. Follow them now; do not load using-dev-kit or pi-tools again.

${bootstrapBody}

${piTools}
</EXTREMELY_IMPORTANT>${cli}`;
		return cachedBootstrap;
	} catch {
		cachedBootstrap = null;
		return null;
	}
}

function stripFrontmatter(content: string): string {
	const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
	return (match ? match[1] : content).trim();
}

function messageContainsBootstrap(message: unknown): boolean {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content.includes(BOOTSTRAP_MARKER);
	if (!Array.isArray(content)) return false;
	return content.some((part) => {
		return (
			part !== null &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text" &&
			typeof (part as { text?: unknown }).text === "string" &&
			(part as { text: string }).text.includes(BOOTSTRAP_MARKER)
		);
	});
}

function firstNonCompactionSummaryIndex(messages: unknown[]): number {
	let index = 0;
	while ((messages[index] as { role?: unknown } | undefined)?.role === "compactionSummary") {
		index += 1;
	}
	return index;
}
