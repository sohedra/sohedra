// Every component of the primitives packages has the test files its kind needs, named by the scheme
// in contributing/tests.md. A component without one lists it in its package's
// `tests/coverage-exemptions.json` with a reason, or "todo: …" for coverage still to write; a test
// file off the scheme is listed as `scheme:<file>`. An exemption for a kind the component now has,
// or for a file that follows the scheme, fails too, so the file only shrinks.
//
//   node scripts/primitives-tests.ts          check
//   node scripts/primitives-tests.ts --list   what each component is missing

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PRIMITIVES } from "./primitives-layout.ts";

/** The closed list of topics a test file name may carry (contributing/tests.md § File names). */
export const TOPICS = [
	"form",
	"field",
	"keyboard",
	"pointer",
	"focus",
	"dismiss",
	"hover",
	"nested",
	"position",
	"direction",
	"transitions",
	"portal",
	"scroll-lock",
	"typeahead",
	"filter",
	"selection",
	"swipe",
	"detached-triggers",
	"lifecycle",
	"bindings",
	"reactivity",
] as const;
const QUALIFIERS = ["async", "production", "svelte"];
const PLATFORM_KINDS: Record<string, string[]> = {
	"primitives-web": ["conformance", "a11y", "ssr", "hydration", "exports"],
	"primitives-lynx": ["conformance"],
};
const PLATFORM_FIXTURES: Record<string, string[]> = {
	"primitives-web": ["demo", "page"],
	"primitives-lynx": ["demo"],
};
const MAX_LINES = 600;
const EXEMPTIONS = "tests/coverage-exemptions.json";

type Exemptions = Record<string, Record<string, string>>;

/** One package's components, each with the kinds it has and lacks. */
interface Coverage {
	pkg: string;
	component: string;
	kinds: Map<string, boolean>;
	/** Each test file or fixture off the scheme, by its name in the component's test folder. */
	scheme: Map<string, string[]>;
}

/** What is missing, misnamed or exempted for nothing in the primitives packages of `root`. */
export function checkPrimitivesTests(root: string): string[] {
	const problems: string[] = [];
	for (const pkg of PRIMITIVES) {
		const dir = join(root, "packages", pkg);
		if (!existsSync(join(dir, "src/components"))) continue;
		const file = `packages/${pkg}/${EXEMPTIONS}`;
		let exemptions: Exemptions = {};
		if (existsSync(join(dir, EXEMPTIONS))) {
			try {
				// Boundary: JSON has no type; the shape is checked below.
				exemptions = JSON.parse(readFileSync(join(dir, EXEMPTIONS), "utf8")) as Exemptions;
			} catch {
				problems.push(`${file} is not JSON.`);
				continue;
			}
		}
		const coverage = coverageOf(root, pkg);
		for (const { component, kinds, scheme } of coverage) {
			const exempt = exemptions[component] ?? {};
			for (const [kind, has] of kinds) {
				if (!has && !exempt[kind]) {
					problems.push(
						`packages/${pkg}: ${component} has no ${kind}. Add it, or a reason to ${file}.`,
					);
				}
				if (has && exempt[kind]) {
					problems.push(
						`packages/${pkg}: ${component} has ${kind} now. Remove its exemption from ${file}.`,
					);
				}
			}
			for (const [name, messages] of scheme) {
				if (!exempt[`scheme:${name}`]) problems.push(...messages);
			}
			for (const kind of Object.keys(exempt)) {
				if (kind.startsWith("scheme:") && !scheme.has(kind.slice("scheme:".length))) {
					problems.push(
						`packages/${pkg}: ${component}'s ${kind.slice("scheme:".length)} follows the scheme now, or is gone. Remove its exemption from ${file}.`,
					);
				}
			}
		}
		const names = new Map(coverage.map((entry) => [entry.component, entry]));
		for (const [component, exempt] of Object.entries(exemptions)) {
			const entry = names.get(component);
			if (entry === undefined) {
				problems.push(`${file} lists ${component}, which isn't a component of ${pkg}.`);
				continue;
			}
			for (const [kind, reason] of Object.entries(exempt)) {
				if (!kind.startsWith("scheme:") && !entry.kinds.has(kind)) {
					problems.push(
						`${file} lists ${kind} for ${component}, which isn't one of its kinds: ${[...entry.kinds.keys(), "scheme:<file>"].join(", ")}.`,
					);
				}
				if (typeof reason !== "string" || reason.trim() === "" || reason.trim() === "todo") {
					problems.push(
						`${file}: give ${component}'s ${kind} exemption a reason, or "todo: <what to write>".`,
					);
				}
			}
		}
	}
	return problems;
}

/** Each component of `pkg` with the kinds it needs and whether it has them. */
function coverageOf(root: string, pkg: string): Coverage[] {
	const src = join(root, "packages", pkg, "src/components");
	return readdirSync(src, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map(({ name: component }) => {
			const sources = readdirSync(join(src, component));
			const testDir = join(root, "packages", pkg, "tests/components", component);
			const tests = existsSync(testDir) ? readdirSync(testDir, { withFileTypes: true }) : [];
			const files = tests.filter((entry) => entry.isFile()).map((entry) => entry.name);
			const fixtures = existsSync(join(testDir, "fixtures"))
				? readdirSync(join(testDir, "fixtures"))
				: [];
			const kinds = new Map<string, boolean>();
			if (pkg === "primitives-core") {
				for (const source of sources) {
					const store = /^(.+-store)\.svelte\.ts$/.exec(source)?.[1];
					const rules = /^(.+-rules)\.ts$/.exec(source)?.[1];
					if (store !== undefined) kinds.set(store, files.includes(`${store}.svelte.test.ts`));
					if (rules !== undefined) kinds.set(rules, files.includes(`${rules}.test.ts`));
				}
			} else {
				for (const part of partsOf(component, sources)) {
					kinds.set(`part:${part}`, files.includes(`${component}-${part}.test.ts`));
				}
				for (const kind of PLATFORM_KINDS[pkg] ?? []) {
					kinds.set(kind, files.includes(`${component}.${kind}.test.ts`));
				}
				for (const fixture of PLATFORM_FIXTURES[pkg] ?? []) {
					kinds.set(`fixture:${fixture}`, fixtures.includes(`${component}-${fixture}.svelte`));
				}
			}
			const scheme = schemeProblems(
				`packages/${pkg}/tests/components/${component}`,
				testDir,
				component,
				pkg,
				partsOf(component, sources),
				tests,
			);
			return { pkg, component, kinds, scheme };
		});
}

function partsOf(component: string, sources: string[]): string[] {
	return sources.flatMap((source) => {
		const part = new RegExp(`^${component}-([a-z0-9-]+)\\.svelte$`).exec(source)?.[1];
		return part === undefined ? [] : [part];
	});
}

/** The test files of one component that break the naming scheme, the first-line rule or the length. */
function schemeProblems(
	where: string,
	dir: string,
	component: string,
	pkg: string,
	parts: string[],
	entries: { name: string; isFile(): boolean; isDirectory(): boolean }[],
): Map<string, string[]> {
	const problems = new Map<string, string[]>();
	const add = (name: string, message: string): void => {
		problems.set(name, [...(problems.get(name) ?? []), message]);
	};
	const kinds = PLATFORM_KINDS[pkg] ?? [];
	for (const entry of entries) {
		const file = `${where}/${entry.name}`;
		if (entry.isDirectory()) {
			if (entry.name === "fixtures") {
				for (const [name, message] of fixtureProblems(file, join(dir, "fixtures"), component)) {
					add(`fixtures/${name}`, message);
				}
			} else {
				add(entry.name, `${file}: a component's tests hold only test files and fixtures/.`);
			}
			continue;
		}
		const name = testName(entry.name, component, pkg, parts, kinds);
		if (name !== undefined) {
			add(entry.name, `${file}: ${name}`);
			continue;
		}
		const text = readFileSync(join(dir, entry.name), "utf8");
		if (!/^\/\/ \S/.test(text)) {
			add(entry.name, `${file}: start with a line comment that says what the file covers.`);
		}
		const lines = text.split("\n").length;
		if (lines > MAX_LINES) {
			add(entry.name, `${file} has ${lines} lines. Split it by topic below ${MAX_LINES}.`);
		}
	}
	return problems;
}

/** Why a test file's name breaks the scheme, or undefined when it follows it. */
function testName(
	name: string,
	component: string,
	pkg: string,
	parts: string[],
	kinds: string[],
): string | undefined {
	const match = /^(?<subject>[a-z0-9-]+)(?<dots>(?:\.[a-z0-9-]+)*)\.test\.ts$/.exec(name);
	if (match?.groups === undefined) return "name it <subject>[.<topic>].test.ts.";
	const { subject, dots } = match.groups as { subject: string; dots: string };
	const words = dots.split(".").filter(Boolean);
	const qualifiers: string[] = [];
	while (words.length > 0 && QUALIFIERS.includes(words.at(-1)!)) qualifiers.unshift(words.pop()!);
	const topic = words.join(".");
	if (pkg === "primitives-core") {
		const store = new RegExp(`^${component}(-[a-z0-9-]+)?-(store|rules)$`).test(subject);
		if (!store) return `name it ${component}[-<part>]-store or -rules, then .<topic>.`;
		if (subject.endsWith("-store") && !qualifiers.includes("svelte")) {
			return "a store test uses runes: end it .svelte.test.ts.";
		}
	} else if (subject === component) {
		if (topic === "") return `name it ${component}.<topic>.test.ts or ${component}-<part>.test.ts.`;
		if (kinds.includes(topic)) return undefined;
	} else {
		const part = subject.slice(component.length + 1);
		if (!subject.startsWith(`${component}-`) || !parts.includes(part)) {
			return `start with ${component}-<part>, a part of ${component} (${parts.join(", ")}), or ${component}.`;
		}
	}
	if (topic !== "" && !(TOPICS as readonly string[]).includes(topic)) {
		return `"${topic}" isn't on the topic list (contributing/tests.md § File names). Use one, or add it there and to TOPICS here.`;
	}
	return undefined;
}

/** A fixtures folder is flat and holds only `<x>-<what>.svelte` components. */
function fixtureProblems(where: string, dir: string, component: string): [string, string][] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, string][] => {
		const file = `${where}/${entry.name}`;
		if (entry.isDirectory()) return [[entry.name, `${file}: fixtures stay flat.`]];
		if (new RegExp(`^${component}-[a-z0-9-]+\\.svelte$`).test(entry.name)) return [];
		return [
			[entry.name, `${file}: fixtures hold only components, named ${component}-<what>.svelte.`],
		];
	});
}

if (import.meta.main) {
	if (process.argv.includes("--list")) {
		for (const pkg of PRIMITIVES) {
			if (!existsSync(join("packages", pkg, "src/components"))) continue;
			for (const { component, kinds, scheme } of coverageOf(".", pkg)) {
				const missing = [...kinds].filter(([, has]) => !has).map(([kind]) => kind);
				if (scheme.size > 0) missing.push(`scheme (${[...scheme.keys()].join(", ")})`);
				if (missing.length > 0) console.log(`${pkg} ${component}: ${missing.join(", ")}`);
			}
		}
	} else {
		const problems = checkPrimitivesTests(".");
		for (const problem of problems) console.error(problem);
		process.exit(problems.length > 0 ? 1 : 0);
	}
}
