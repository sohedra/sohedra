// Checks the repository's own setup, so decisions written in AGENTS.md and CONTRIBUTING.md can't
// drift. Runs as part of `pnpm lint`.

import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { parse } from "yaml";

import { readLabels } from "./labels.ts";

const problems: string[] = [];
const IGNORED_DIRS = new Set([".git", "node_modules", ".svelte-kit", "dist", "coverage"]);
// Agent worktrees are other checkouts of this repository, checked in their own run.
const IGNORED_PATHS = new Set([join(".claude", "worktrees")]);

/** Every file under `dir`, as paths relative to the repository root, skipping build and VCS folders. */
function walk(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (IGNORED_DIRS.has(entry.name) || IGNORED_PATHS.has(path)) {
			continue;
		}
		if (entry.isDirectory()) {
			files.push(...walk(path));
		} else {
			files.push(relative(".", path));
		}
	}
	return files;
}

const allFiles = walk(".");

// 1. Labels: a valid labels file, and forms that only use labels from it.
let labelNames = new Set<string>();
try {
	const labels = readLabels();
	labelNames = new Set(labels.map((label) => label.name));
	if (labelNames.size !== labels.length) {
		problems.push(".github/labels.yml lists a label twice.");
	}
	for (const label of labels) {
		if (!/^[0-9a-f]{6}$/i.test(label.color)) {
			problems.push(
				`.github/labels.yml: "${label.name}" needs a six-digit hex color, without "#".`,
			);
		}
		if (label.description.length > 100) {
			problems.push(
				`.github/labels.yml: shorten the description of "${label.name}" to 100 characters.`,
			);
		}
	}
} catch (error) {
	problems.push((error as Error).message);
}
const forms = allFiles.filter((file) =>
	/^\.github\/(ISSUE_TEMPLATE|DISCUSSION_TEMPLATE)\/.+\.ya?ml$/.test(file),
);
for (const form of forms) {
	const data = parse(readFileSync(form, "utf8")) as { labels?: string[] | string } | null;
	const used = typeof data?.labels === "string" ? data.labels.split(",") : (data?.labels ?? []);
	for (const label of used.map((name) => name.trim())) {
		if (!labelNames.has(label)) {
			problems.push(
				`${form} adds the label "${label}", which isn't in .github/labels.yml. GitHub would drop it silently.`,
			);
		}
	}
}

// 2. Agent instructions: AGENTS.md files only, each within its length budget.
for (const file of allFiles) {
	const name = file.split("/").pop();
	if (name === "CLAUDE.md" || name === "CLAUDE.local.md") {
		problems.push(
			`${file}: remove it. Any CLAUDE.md file stops Claude Code from reading AGENTS.md.`,
		);
	}
	if (name === "AGENTS.md") {
		const text = readFileSync(file, "utf8");
		const lines = text.split("\n").length - 1;
		const bytes = Buffer.byteLength(text);
		const root = file === "AGENTS.md";
		const maxLines = root ? 90 : 40;
		const maxBytes = root ? 5120 : 3072;
		if (lines > maxLines || bytes > maxBytes) {
			problems.push(
				`${file} has ${lines} lines and ${bytes} bytes; keep it within ${maxLines} lines and ${maxBytes} bytes. Move procedures into a skill.`,
			);
		}
	}
}

// 3. Hidden Unicode in agent files, which can steer an agent without showing in a diff.
const HIDDEN = /[​-‏‪-‮⁦-⁩\u{E0000}-\u{E007F}]/u;
const agentFiles = allFiles.filter(
	(file) =>
		file.endsWith("AGENTS.md") || file.startsWith(".agents/") || file.startsWith(".claude/"),
);
for (const file of agentFiles) {
	if (statSync(file).isFile() && HIDDEN.test(readFileSync(file, "utf8"))) {
		problems.push(
			`${file} contains hidden Unicode characters (zero-width, bidirectional or tag). Remove them.`,
		);
	}
}

// 4. Committed Claude Code settings: nothing that runs code or widens permissions.
if (existsSync(".claude/settings.json")) {
	const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8")) as {
		hooks?: unknown;
		env?: unknown;
		apiKeyHelper?: unknown;
		permissions?: { allow?: unknown; defaultMode?: unknown };
	};
	const forbidden = [
		["hooks", settings.hooks],
		["env", settings.env],
		["apiKeyHelper", settings.apiKeyHelper],
		["permissions.allow", settings.permissions?.allow],
		["permissions.defaultMode", settings.permissions?.defaultMode],
	] as const;
	for (const [key, value] of forbidden) {
		if (value !== undefined) {
			problems.push(
				`.claude/settings.json sets "${key}". Remove it: committed settings must not run code or widen permissions.`,
			);
		}
	}
}

// 5. Skills: each one in .agents/skills/, linked from .claude/skills/.
const skills = existsSync(".agents/skills")
	? readdirSync(".agents/skills", { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
	: [];
for (const skill of skills) {
	if (!existsSync(join(".agents/skills", skill, "SKILL.md"))) {
		problems.push(`.agents/skills/${skill} has no SKILL.md.`);
	}
	const link = join(".claude/skills", skill);
	const target = join("../../.agents/skills", skill);
	if (!existsSync(link) || !lstatSync(link).isSymbolicLink() || readlinkSync(link) !== target) {
		problems.push(`Link the skill for Claude Code: ln -s ${target} ${link}`);
	}
}
if (existsSync(".claude/skills")) {
	for (const entry of readdirSync(".claude/skills")) {
		if (!skills.includes(entry)) {
			problems.push(
				`.claude/skills/${entry} isn't a link to .agents/skills/. Put the skill in .agents/skills/ and link it.`,
			);
		}
	}
}

// 6. Packages: each has its own tsconfig.json, and the root has none.
if (existsSync("tsconfig.json")) {
	problems.push("Remove the root tsconfig.json: each package has its own.");
}
const workspace = parse(readFileSync("pnpm-workspace.yaml", "utf8")) as { packages?: string[] };
for (const pattern of workspace.packages ?? []) {
	const dirs = pattern.endsWith("/*")
		? existsSync(pattern.slice(0, -2))
			? readdirSync(pattern.slice(0, -2), { withFileTypes: true })
					.filter((entry) => entry.isDirectory())
					.map((entry) => join(pattern.slice(0, -2), entry.name))
			: []
		: existsSync(pattern)
			? [pattern]
			: [];
	for (const dir of dirs) {
		if (existsSync(join(dir, "package.json")) && !existsSync(join(dir, "tsconfig.json"))) {
			problems.push(`${dir} has no tsconfig.json. Every package has its own.`);
		}
	}
}

if (problems.length > 0) {
	console.error(["Repository check failed:", ...problems].join("\n- "));
	process.exit(1);
}
console.log("Repository check passed.");
