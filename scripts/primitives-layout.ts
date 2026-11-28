// The primitives packages keep one layout (contributing/architecture.md § Folders and files): `src/`
// holds `components/<name>/` and `foundation/<job>/`, both flat; every file starts with its folder's
// name and is named after the idea of its main export; one class per file; each folder has an
// `index.ts` whose first line says what it is for; `.svelte.ts` exactly when a file uses runes;
// parts and stores keep their numbered sections.
//
//   node scripts/primitives-layout.ts

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";

/** The packages that follow the layout. A package that doesn't exist yet is skipped. */
export const PRIMITIVES = ["primitives-core", "primitives-web", "primitives-lynx"] as const;
const BUCKETS = ["components", "foundation"];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = /^(?<base>[a-z0-9]+(?:-[a-z0-9]+)*)(?<ext>\.svelte\.ts|\.svelte|\.ts)$/;
const RUNE = /\$(?:state|derived|effect|props|bindable|inspect|host)\b(?:\.\w+)?\s*\(/;
const MAP_FILE = "contributing/architecture.md";
const PART_SECTIONS = ["Props", "Store and context", "Shared behaviours", "Own wiring"];
const STORE_SECTIONS = ["Inputs", "Owned objects", "Public state", "Intents", "Lifetime"];
const SECTION = /^\s*\/\/ (\d+)\. ([^.`:]+?)(?:[.:].*)?$/;
const CLASS = /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Z]\w*)/gm;
const NAMED_EXPORT = /^export\s+(?:async\s+)?(?:function\s+|const\s+)((?:use|attach)[A-Z]\w*)/gm;

/**
 * Exported names that don't carry their file's idea words, keyed `<file>#<name>`, and files the
 * other rules leave alone, keyed `<file>#<rule>`. Each says why, or "todo:" for a violation to fix.
 */
const EXEMPTIONS: Record<string, string> = {
	"packages/primitives-web/src/foundation/button/button-semantics.ts#useButton":
		"The pressable-part wiring is named for the element it makes, a button; the file for what it holds, button semantics.",
	"packages/primitives-web/src/foundation/kernel/kernel-claim.svelte.ts#useClaimedId":
		"A claim's second side: `attachClaim` makes the claim and `useClaimedId` hands out the claimed id, one idea in one file.",
	"packages/primitives-core/src/foundation/presence/presence.svelte.ts#prefix":
		"todo: rename to presence-store.svelte.ts, its class to PresenceStore, and their imports.",
};

/** What breaks the layout in the primitives packages of `root`. */
export function checkPrimitivesLayout(root: string): string[] {
	const findings: Finding[] = [];
	const mapped = jobsInFolderMap(root);
	for (const name of PRIMITIVES) {
		const src = join(root, "packages", name, "src");
		if (!existsSync(src)) continue;
		const at = `packages/${name}/src`;
		for (const entry of readdirSync(src, { withFileTypes: true })) {
			const isEntry = entry.isFile() && entry.name === "index.ts";
			if (isEntry || (entry.isDirectory() && BUCKETS.includes(entry.name))) continue;
			findings.push({
				key: `${at}/${entry.name}`,
				message: `${at}/${entry.name}: src/ holds only components/, foundation/ and the package entry index.ts.`,
			});
		}
		for (const bucket of BUCKETS) {
			const dir = join(src, bucket);
			if (!existsSync(dir)) continue;
			for (const folder of readdirSync(dir, { withFileTypes: true })) {
				const where = `${at}/${bucket}/${folder.name}`;
				if (!folder.isDirectory()) {
					findings.push({
						key: where,
						message: `${where}: put it in a ${bucket === "components" ? "component" : "job"} folder.`,
					});
					continue;
				}
				if (!KEBAB.test(folder.name)) {
					findings.push({ key: where, message: `${where}: name the folder in kebab-case.` });
				}
				if (bucket === "foundation" && mapped !== undefined && !mapped.has(folder.name)) {
					findings.push({
						key: where,
						message: `${where}: add the job's row to the folder map in ${MAP_FILE} in the same change.`,
					});
				}
				findings.push(...checkFolder(join(dir, folder.name), where, folder.name, bucket, name));
			}
		}
	}
	return unexempted(findings, EXEMPTIONS, "scripts/primitives-layout.ts");
}

function checkFolder(
	dir: string,
	where: string,
	folder: string,
	bucket: string,
	pkg: string,
): Finding[] {
	const findings: Finding[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });
	if (!entries.some((entry) => entry.name === "index.ts")) {
		findings.push({
			key: where,
			message: `${where} has no index.ts. Each folder's index.ts is its face to other folders.`,
		});
	}
	for (const entry of entries) {
		const file = `${where}/${entry.name}`;
		const report = (message: string, rule: string): void => {
			findings.push({ key: `${file}#${rule}`, message: `${file}${message}` });
		};
		if (entry.isDirectory()) {
			report(`: folders stay flat. Move its files up, named ${folder}-<idea>.`, "flat");
			continue;
		}
		const text = readFileSync(join(dir, entry.name), "utf8");
		if (entry.name === "index.ts") {
			if (!/^\/\/ \S/.test(text)) {
				report(": start with a line comment that says what the folder is for.", "index-line");
			}
			continue;
		}
		const match = FILE.exec(entry.name);
		if (match?.groups === undefined) {
			report(": name it <folder>-<idea> in kebab-case, ending .ts, .svelte.ts or .svelte.", "name");
			continue;
		}
		const { base, ext } = match.groups as { base: string; ext: string };
		const single = bucket === "components" && ext === ".svelte" && base === folder;
		if (!single && !base.startsWith(`${folder}-`)) {
			report(`: start the name with the folder's: ${folder}-<idea>${ext}.`, "prefix");
		}
		const code = codeText(text, entry.name, { strings: true }).code;
		const uses = ext !== ".svelte" && RUNE.test(code);
		if (ext === ".svelte.ts" && !uses) report(" uses no runes: rename it to .ts.", "runes");
		if (ext === ".ts" && uses) report(" uses runes: rename it to .svelte.ts.", "runes");
		if (ext === ".svelte") {
			for (const message of checkPart(text, bucket === "components")) report(message, "part");
			continue;
		}
		const ideaWords = base.startsWith(`${folder}-`) ? base.slice(folder.length + 1).split("-") : [];
		const classes = [...code.matchAll(CLASS)].map((found) => found[1]!);
		if (classes.length > 1) {
			report(
				` holds ${classes.length} classes (${classes.join(", ")}): one class per file.`,
				"classes",
			);
		}
		for (const name of [
			...classes,
			...[...code.matchAll(NAMED_EXPORT)].map((found) => found[1]!),
		]) {
			if (!carriesIdea(name, ideaWords)) {
				report(
					`: ${name} doesn't name the file's idea (${ideaWords.join(" ")}). Rename it or the file, so each leads to the other.`,
					name,
				);
			}
		}
		if (pkg === "primitives-core" && classes.some((name) => name.endsWith("Store"))) {
			for (const message of checkStore(text)) report(message, "sections");
		}
	}
	return findings;
}

/** Whether a class or wiring's name holds every idea word of its file, a plural matching too. */
function carriesIdea(name: string, ideaWords: string[]): boolean {
	const words = name
		.replace(/^(?:use|attach)(?=[A-Z])/, "")
		.split(/(?=[A-Z])/)
		.map((word) => word.toLowerCase());
	return ideaWords.every((idea) =>
		words.some((word) => word === idea || `${word}s` === idea || word === `${idea}s`),
	);
}

/**
 * A part's script keeps its numbered sections in order: Props, Store and context, Shared
 * behaviours, Own wiring. A section with nothing in it is left out. A component's part also
 * starts with its `@component` doc comment and always has Props; a shared part in a job has them
 * when it has sections at all.
 */
function checkPart(text: string, isComponent: boolean): string[] {
	const problems: string[] = [];
	if (isComponent && !/^<!--\s*\n?\s*@component\b/.test(text)) {
		problems.push(": start with the part's <!-- @component --> doc comment.");
	}
	const script = /<script\b(?![^>]*\bmodule\b)[^>]*>([\s\S]*?)<\/script>/.exec(text);
	const offset = script === null ? 0 : text.slice(0, script.index).split("\n").length - 1;
	const sections = sectionsOf(script?.[1] ?? "", offset);
	if (isComponent && sections[0]?.number !== 1) {
		problems.push(': the script starts with "// 1. Props".');
	}
	problems.push(...checkSections(sections, PART_SECTIONS));
	return problems;
}

/** A store class keeps its five numbered sections in order. */
function checkStore(text: string): string[] {
	const sections = sectionsOf(text, 0);
	if (sections.length === 0) {
		return [
			`: a store keeps the numbered sections ${STORE_SECTIONS.map((name, index) => `"// ${index + 1}. ${name}"`).join(", ")}.`,
		];
	}
	return checkSections(sections, STORE_SECTIONS);
}

function checkSections(
	sections: { number: number; name: string; line: number }[],
	names: string[],
): string[] {
	const problems: string[] = [];
	let last = 0;
	for (const { number, name, line } of sections) {
		if (names[number - 1] !== name) {
			problems.push(
				`:${line} has "// ${number}. ${name}"; the sections are ${names.map((each, index) => `${index + 1}. ${each}`).join(", ")}.`,
			);
		}
		if (number <= last) {
			problems.push(`:${line}: section ${number} comes after section ${last}. Keep them in order.`);
		}
		last = number;
	}
	return problems;
}

function sectionsOf(
	text: string,
	offset: number,
): { number: number; name: string; line: number }[] {
	return text.split("\n").flatMap((line, index) => {
		const match = SECTION.exec(line);
		return match === null
			? []
			: [{ number: Number(match[1]), name: match[2]!.trim(), line: offset + index + 1 }];
	});
}

/** The jobs in the first column of the folder map, or undefined when the file isn't there. */
function jobsInFolderMap(root: string): Set<string> | undefined {
	const path = join(root, MAP_FILE);
	if (!existsSync(path)) return undefined;
	const section =
		/^### Folder map$([\s\S]*?)(?=^#{1,3} )/m.exec(readFileSync(path, "utf8"))?.[1] ?? "";
	return new Set([...section.matchAll(/^\| `([a-z0-9-]+)`\s+\|/gm)].map((match) => match[1]!));
}

if (import.meta.main) {
	const problems = checkPrimitivesLayout(".");
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
