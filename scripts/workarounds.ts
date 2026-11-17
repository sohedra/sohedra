// Reads the workaround tags of the repository: code that exists because of something outside our
// control says so in a doc comment where it lives (see CONTRIBUTING.md § Code, Workarounds). The
// list of them is generated from the tags and is the checklist for a Lynx or Svelte upgrade.
//
//   node scripts/workarounds.ts           print the list
//   node scripts/workarounds.ts --write   write it to docs/workarounds.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { sourceFiles } from "./source-files.ts";

export const KINDS = ["lynx-limit", "lynx-bug", "lynx-gap", "svelte-internal", "tooling"] as const;
export const LIST_FILE = "docs/workarounds.md";

export interface Workaround {
	name: string;
	kind: string;
	upstream?: string;
	deleteWhen: string;
	file: string;
	line: number;
}

const KEYS = ["kind", "upstream", "delete-when"];
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const START = /^\s*(?:\/\*\*?|\*|\/\/)\s*@workaround\b(.*)$/;
const SOURCE = /\.(?:[cm]?[jt]s|svelte|css)$/;

/** The tag text after `@workaround` as one string: its line, and the comment lines that continue it. */
function tagText(lines: string[], at: number, first: string): string {
	let text = first;
	let line = lines[at] ?? "";
	const block = !line.trimStart().startsWith("//");
	let index = at;
	while (!line.includes("*/") && block !== line.trimStart().startsWith("//")) {
		const next = lines[++index];
		if (next === undefined) break;
		const stripped = next.trim().replace(/^(?:\*(?!\/)|\/\/)\s?/, "");
		if (next.trim().startsWith("*/") || stripped.startsWith("@") || stripped.trim() === "") break;
		if (!block && !next.trim().startsWith("//")) break;
		text += ` ${stripped}`;
		line = next;
	}
	return text.replace(/\*\/.*$/, "").trim();
}

/** The workaround tags in one file's text, and what is wrong with them. */
export function readWorkarounds(
	file: string,
	text: string,
): { workarounds: Workaround[]; problems: string[] } {
	const workarounds: Workaround[] = [];
	const problems: string[] = [];
	const lines = text.split("\n");
	lines.forEach((line, index) => {
		const start = START.exec(line);
		if (start === null) return;
		const where = `${file}:${index + 1}`;
		const body = tagText(lines, index, start[1] ?? "");
		const name = /^\S+/.exec(body)?.[0] ?? "";
		const fail = (message: string): void => void problems.push(`${where}: ${message}`);
		if (name === "" || name.includes("=")) {
			return fail("a workaround tag starts with its name, in lower-case words joined by hyphens.");
		}
		if (!NAME.test(name)) {
			return fail(`"${name}" is not a workaround name: use lower-case words joined by hyphens.`);
		}
		const values = new Map<string, string>();
		let valid = true;
		const rest = body
			.slice(name.length)
			.replace(/([\w-]+)=(?:"([^"]*)"|(\S+))/g, (_, key, quoted, bare) => {
				if (!KEYS.includes(key)) {
					fail(`"${key}" is not a workaround key (${KEYS.join(", ")}).`);
					valid = false;
				} else if (values.has(key)) {
					fail(`${name} repeats ${key}.`);
					valid = false;
				} else values.set(key, quoted ?? bare);
				return "";
			});
		if (rest.trim() !== "") {
			fail(`${name} has text that is not a key=value pair: ${rest.trim()}`);
			valid = false;
		}
		const kind = values.get("kind");
		if (kind === undefined || !(KINDS as readonly string[]).includes(kind)) {
			fail(
				kind === undefined
					? `${name} needs kind=<${KINDS.join("|")}>.`
					: `${name} has kind=${kind}, which is not one of ${KINDS.join(", ")}.`,
			);
			valid = false;
		}
		const deleteWhen = values.get("delete-when")?.trim() ?? "";
		if (deleteWhen === "") {
			fail(`${name} needs delete-when="<when the code can go, in words>".`);
			valid = false;
		}
		const upstream = values.get("upstream");
		if (upstream !== undefined && !upstream.startsWith("https://")) {
			fail(`${name} has upstream=${upstream}: give the https link of the public issue.`);
			valid = false;
		}
		if (valid && kind !== undefined) {
			workarounds.push({
				name,
				kind,
				...(upstream !== undefined && { upstream }),
				deleteWhen,
				file,
				line: index + 1,
			});
		}
	});
	return { workarounds, problems };
}

/** Every workaround of the repository at `root`, and what is wrong with the tags. */
export function scanRepository(root: string): { workarounds: Workaround[]; problems: string[] } {
	const workarounds: Workaround[] = [];
	const problems: string[] = [];
	for (const file of sourceFiles(root, { names: SOURCE })) {
		const found = readWorkarounds(file, readFileSync(join(root, file), "utf8"));
		workarounds.push(...found.workarounds);
		problems.push(...found.problems);
	}
	const places = new Map<string, Workaround>();
	for (const workaround of workarounds) {
		const first = places.get(workaround.name);
		if (first === undefined) places.set(workaround.name, workaround);
		else {
			problems.push(
				`${workaround.file}:${workaround.line}: the name ${workaround.name} is already used at ${first.file}:${first.line}. Give each workaround its own name.`,
			);
		}
	}
	return { workarounds, problems };
}

/** The list as Markdown, by name. */
export function workaroundList(workarounds: Workaround[]): string {
	const rows = workarounds
		.toSorted((a, b) => a.name.localeCompare(b.name))
		.map(
			(w) =>
				`| \`${w.name}\` | ${w.kind} | ${w.file}:${w.line} | ${w.deleteWhen} | ${w.upstream ?? ""} |`,
		);
	return [
		"# Workarounds",
		"",
		"Generated from the workaround tags in the code by `node scripts/workarounds.ts --write`. Don't edit it.",
		"",
		"| Workaround | Kind | Where | Delete when | Upstream |",
		"| --- | --- | --- | --- | --- |",
		...rows,
		"",
	].join("\n");
}

/** Whether the committed list, if there is one, matches the tags. */
export function listIsCurrent(root: string, workarounds: Workaround[]): boolean {
	const file = join(root, LIST_FILE);
	return !existsSync(file) || readFileSync(file, "utf8") === workaroundList(workarounds);
}

if (import.meta.main) {
	const root = join(dirname(import.meta.filename), "..");
	const { workarounds, problems } = scanRepository(root);
	if (problems.length > 0) {
		console.error(problems.join("\n"));
		process.exit(1);
	}
	const list = workaroundList(workarounds);
	if (process.argv.includes("--write")) writeFileSync(join(root, LIST_FILE), list);
	else console.log(list);
}
