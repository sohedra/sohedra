// The checks of an app's scripts for code that type-checks and then fails on Lynx: a global the
// thread's engine lacks (with the import that fills it, or what to use instead), the web's DOM, and
// an API only the other thread has. Each is an error at its place: the code fails wherever it runs.
// A read the script checks for first (`typeof X`, `"X" in globalThis`, a `try` with a `catch`) is
// left alone, and so is a line the silencing comment names the code on.
//
// Whether the app fills a global is the whole build's to say, not one file's: a read a fill would
// give comes back as pending, and the build reports it once every module is known
// (plugin/missing-fills.ts).

import { engineHas, globalGap } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { BuildCode } from "../diagnostics/catalogue.ts";
import { placeAt } from "../diagnostics/messages.ts";
import type { AnyReport, Report, SourceText } from "../diagnostics/messages.ts";
import { DOM_INSTEAD, domGlobal } from "./dom-globals.ts";
import { scriptUses } from "./script-uses.ts";
import type { GlobalRead, ScriptRoots } from "./script-uses.ts";
import { silencer } from "./silencing.ts";
import { isMissingLynxMember, onlyThread } from "./thread-apis.ts";

/** The package whose imports fill the globals, and its subpaths. */
const POLYFILL = /^@sohedra\/lynx-polyfill(?:\/[\w-]+)?$/;

/** A read of a global that a fill gives, which is an error unless the app fills it. */
export interface PendingFill {
	/** The import that fills it. */
	module: string;
	/** Whether the catch-all import fills it too. */
	baseline: boolean;
	/** The error, should the app fill it neither way. */
	report: Report<"fill_not_imported">;
}

/** What a file's checks found. */
interface ScriptFindings {
	errors: AnyReport[];
	fills: PendingFill[];
	/** The fills the file imports itself. */
	imports: string[];
	/** The globals the file puts on the global object itself. */
	installs: string[];
}

/** What a read lacks, for the message: the threads that lack it, by name. */
function lacking(threads: readonly Thread[], all: readonly Thread[]): string {
	if (threads.length === all.length && all.length > 1) return "engine";
	return threads[0] === "main-thread" ? "main thread" : "background thread";
}

/** A fill a read waits on, and what it lacks without it ("engine", "main thread"…). */
type Waits = Omit<PendingFill, "report"> & { lacks: string };

/** What the global read `read` is, as a report, or a fill it waits on; nothing when it works. */
function finding(read: GlobalRead): AnyReport | Waits | undefined {
	const { name, threads, flagged, topLevel } = read;
	if (threads.length === 0) return undefined;
	const where = topLevel ? "top_level" : "function";
	if (isMissingLynxMember(name)) return { code: "lynx_member_missing", details: { api: name } };
	const only = onlyThread(name);
	if (only !== undefined) {
		if (flagged || threads.every((thread) => thread === only)) return undefined;
		return only === "background"
			? { code: "background_api_on_main_thread", details: { api: name, where } }
			: { code: "main_thread_api_in_background", details: { api: name } };
	}
	const lacks: Thread[] = [];
	let fill: { module: string; baseline: boolean } | undefined;
	for (const thread of threads) {
		const gap = globalGap(name, thread);
		if (gap?.kind === "not_on_lynx")
			return { code: "global_no_fill", details: { name, instead: gap.instead } };
		if (gap?.kind === "background_only")
			return flagged
				? undefined
				: { code: "background_api_on_main_thread", details: { api: name, where } };
		if (gap?.kind === "fill" && !engineHas(name, thread)) {
			lacks.push(thread);
			fill = gap;
		}
	}
	if (fill !== undefined)
		return { module: fill.module, baseline: fill.baseline, lacks: lacking(lacks, threads) };
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
		installs: [...uses.installs],
	};
	const own = new Set(findings.imports);
	const seen = new Set<string>();
	/** Whether a report at `start` is a repeat or silenced, at its line or above its element. */
	const quiet = (code: BuildCode, start: number, anchor: number | undefined): boolean => {
		const key = `${code}\0${start}`;
		if (seen.has(key) || silenced(code, start) || (anchor !== undefined && silenced(code, anchor)))
			return true;
		seen.add(key);
		return false;
	};
	for (const read of uses.globals) {
		if (uses.checked.has(read.name)) continue;
		const found = finding(read);
		if (found === undefined) continue;
		const place = placeAt(source, read.start);
		if ("module" in found) {
			const { lacks } = found;
			if (
				isFilled(found, read.name, { imports: own, installs: uses.installs }) ||
				quiet("fill_not_imported", read.start, read.anchor)
			)
				continue;
			findings.fills.push({
				module: found.module,
				baseline: found.baseline,
				report: {
					code: "fill_not_imported",
					details: { name: read.name, module: found.module, baseline: found.baseline, lacks },
					place,
				},
			});
			continue;
		}
		if (quiet(found.code, read.start, read.anchor)) continue;
		// Boundary: `finding` pairs each code with its own details.
		findings.errors.push({ ...found, place } as AnyReport);
	}
	for (const call of uses.plainCalls) {
		if (quiet("plain_function_in_main_thread_function", call.start, call.anchor)) continue;
		findings.errors.push({
			code: "plain_function_in_main_thread_function",
			details: { name: call.name },
			place: placeAt(source, call.start),
		});
	}
	return findings;
}

/** What fills globals in a whole app: imports of the polyfill, and the globals it installs itself. */
interface AppFills {
	/** The polyfill's imports, as written. */
	imports: ReadonlySet<string>;
	/** The globals the app's code, or a fill package it imports, installs. */
	installs: ReadonlySet<string>;
}

/** Whether the app fills `name`, which `fill` waits on. */
export function isFilled(
	fill: Omit<PendingFill, "report">,
	name: string,
	{ imports, installs }: AppFills,
): boolean {
	return (
		installs.has(name) ||
		imports.has(fill.module) ||
		(fill.baseline && imports.has("@sohedra/lynx-polyfill"))
	);
}
