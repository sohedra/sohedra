// The checks of an app's scripts for code that type-checks and then fails on Lynx: a global the
// thread's engine lacks (with the import that fills it, or what to use instead), the web's DOM, and
// an API only the other thread has. Each is an error at its place: the code fails wherever it runs.
// A read the script checks for first (`typeof X`, `"X" in globalThis`) is left alone, and so is a
// line the silencing comment names the code on.
//
// Whether the app imports a fill is the whole build's to say, not one file's: a read a fill would
// give comes back as pending, and the build reports it once every module is known
// (plugin/missing-fills.ts).

import { engineHas, globalGap } from "../../wire/index.ts";
import type { BuildCode } from "../diagnostics/catalogue.ts";
import { placeAt } from "../diagnostics/messages.ts";
import type { AnyReport, Report, SourceText } from "../diagnostics/messages.ts";
import { DOM_INSTEAD, domGlobal } from "./dom-globals.ts";
import { scriptUses } from "./script-uses.ts";
import type { GlobalRead, ScriptRoots } from "./script-uses.ts";
import { silencer } from "./silencing.ts";
import { onlyThread } from "./thread-apis.ts";

/** The package whose imports fill the globals, and its subpaths. */
const POLYFILL = /^@sohedra\/lynx-polyfill(?:\/[\w-]+)?$/;

/** A read of a global that a fill gives, which is an error unless the app imports that fill. */
export interface PendingFill {
	/** The import that fills it. */
	module: string;
	/** Whether the catch-all import fills it too. */
	baseline: boolean;
	/** The error, should the app import neither. */
	report: Report<"fill_not_imported">;
}

/** What a file's checks found. */
export interface ScriptFindings {
	errors: AnyReport[];
	fills: PendingFill[];
	/** The fills the file imports itself. */
	imports: string[];
}

/** What the global read `read` is, as a report, or a fill it waits on; nothing when it works. */
function finding(read: GlobalRead): AnyReport | Omit<PendingFill, "report"> | undefined {
	const { name, thread, flagged } = read;
	const only = onlyThread(name);
	if (only !== undefined) {
		if (flagged || only === thread) return undefined;
		return only === "background"
			? { code: "background_api_in_main_thread_function", details: { api: name } }
			: { code: "main_thread_api_in_background", details: { api: name } };
	}
	const gap = globalGap(name, thread);
	if (gap?.kind === "not_on_lynx")
		return { code: "global_not_in_lynx", details: { name, instead: gap.instead } };
	if (gap?.kind === "background_only")
		return flagged
			? undefined
			: { code: "background_api_in_main_thread_function", details: { api: name } };
	if (gap?.kind === "fill")
		return engineHas(name, thread) ? undefined : { module: gap.module, baseline: gap.baseline };
	const dom = domGlobal(name);
	if (dom !== undefined)
		return { code: "dom_not_on_lynx", details: { name, instead: DOM_INSTEAD[dom] } };
	return undefined;
}

/** The checks of a file's scripts: `source` is the text the roots' positions point into. */
export function checkScripts(source: SourceText, roots: ScriptRoots): ScriptFindings {
	const uses = scriptUses(roots);
	const silenced = silencer(source.text);
	const findings: ScriptFindings = {
		errors: [],
		fills: [],
		imports: [...uses.imports].filter((module) => POLYFILL.test(module)),
	};
	const own = new Set(findings.imports);
	const seen = new Set<string>();
	const quiet = (code: BuildCode, start: number): boolean => {
		const key = `${code}\0${start}`;
		if (seen.has(key) || silenced(code, start)) return true;
		seen.add(key);
		return false;
	};
	for (const read of uses.globals) {
		if (uses.checked.has(read.name)) continue;
		const found = finding(read);
		if (found === undefined) continue;
		const place = placeAt(source, read.start);
		if ("module" in found) {
			if (isFilled(found, own) || quiet("fill_not_imported", read.start)) continue;
			findings.fills.push({
				...found,
				report: {
					code: "fill_not_imported",
					details: { name: read.name, module: found.module, baseline: found.baseline },
					place,
				},
			});
			continue;
		}
		if (quiet(found.code, read.start)) continue;
		// Boundary: `finding` pairs each code with its own details.
		findings.errors.push({ ...found, place } as AnyReport);
	}
	for (const call of uses.plainCalls) {
		if (quiet("plain_function_in_main_thread_function", call.start)) continue;
		findings.errors.push({
			code: "plain_function_in_main_thread_function",
			details: { name: call.name },
			place: placeAt(source, call.start),
		});
	}
	return findings;
}

/** Whether `imports` (the fills a whole app imports) fill what `fill` waits on. */
export function isFilled(fill: Omit<PendingFill, "report">, imports: ReadonlySet<string>): boolean {
	return imports.has(fill.module) || (fill.baseline && imports.has("@sohedra/lynx-polyfill"));
}
