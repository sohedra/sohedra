// The feature table: what each Lynx thread has of the language and the web's APIs, measured on a
// device by the feature-table probe, as rows (features) by columns (an engine, a Lynx version, a
// platform and a thread). A column's id is read from the run's own `SystemInfo`
// (`primjs-<engineVersion>-lynx-<lynxSdkVersion>-<platform>-<mt|bg>`), so a run on another device
// or version adds columns without a change here. Runs that make the same column are compared: a
// cell that differs between them is listed under `variance`, and the table shows the first run's.
//
// Usage: node scripts/feature-table/make-table.ts --out <dir> [--checks <cjtests-src.json>] <run dir>…
// A run dir holds one probe page's reports: bg.json (the background's), ft-mt.json (the main
// thread's, relayed) and net.json (the background's fetch checks). `--checks` is the source of each
// core-js check, which a "wrong" note quotes when no diagnostic row says why.
//
// Statuses: yes (there, and its check gives the specified result), no (missing, or only the
// binding's fill is there), wrong (there, but its check fails: the note says how), param (the
// background reaches it only as a parameter of lynx-core's script wrapper: a free identifier works,
// `globalThis.<name>` is undefined).

import fs from "node:fs";
import path from "node:path";

/** A cell's status. */
export type Status = "yes" | "no" | "wrong" | "param";

/** One cell: a feature on a column. */
export interface Cell {
	status: Status;
	note: string;
}

/** A thread, as a column names it. */
export type ColumnThread = "mt" | "bg";

/** A column: one engine, Lynx version, platform and thread. */
export interface Column {
	id: string;
	engine: string | undefined;
	engineVersion: string | undefined;
	lynxSdkVersion: string | undefined;
	platform: string;
	thread: ColumnThread;
	osVersion: string | undefined;
	runtimeType: string | undefined;
	systemInfo: string | undefined;
	lepusVersion: string | undefined;
	runs: string[];
}

/** A row: a feature, its group and its edition, and its cell on each column. */
export interface Row {
	id: string;
	group: string;
	edition: string;
	cells: Record<string, Cell>;
}

/** A cell that differed between the runs of its column. */
export interface Variance {
	row: string;
	column: string;
	values: ({ run: string } & Partial<Cell>)[];
}

/** The feature table. */
export interface FeatureTable {
	generated: string;
	statuses: Record<Status, string>;
	columns: Column[];
	rows: Row[];
	variance: Variance[];
}

/** A smoke check of a web API: what it gave, and what the standard gives, when known. */
interface Smoke {
	expected?: unknown;
	got?: unknown;
	ok?: boolean;
}

/** A built-in's row of a thread's report: core-js's module, its presence and its check. */
interface BuiltinReport {
	edition?: string;
	present?: boolean;
	test?: string;
	failed?: number;
	error?: string;
}

/** A row the probe checks itself: a built-in with no core-js module, or a diagnostic. */
interface ExtraReport {
	edition?: string;
	present?: boolean;
	expected?: unknown;
	got?: unknown;
	ok?: boolean;
}

/** A syntax row: whether it parses, and what it gives. */
interface SyntaxReport {
	edition?: string;
	skipped?: boolean;
	parses?: boolean;
	error?: string;
	expected?: unknown;
	got?: unknown;
	ok?: boolean;
}

/** A web API's row: its free name and `globalThis`'s, and its smoke checks. */
interface WebReport {
	free?: string;
	glob?: string;
	smoke: Record<string, Smoke>;
}

/** One thread's report of one run. */
export interface ThreadReport {
	facts: Record<string, string | undefined>;
	builtins: Record<string, BuiltinReport>;
	extra: Record<string, ExtraReport>;
	syntax: Record<string, SyntaxReport>;
	web: Record<string, WebReport>;
	async: Record<string, unknown>;
	asyncState?: string;
}

/** The background's fetch checks of one run, as far as the table reads them. */
export interface NetReport {
	"event-source"?: { seen: string[] } | string;
	[check: string]: unknown;
}

/** One run of the probe: its name, each thread's report, and the background's fetch checks. */
export interface Run {
	name: string;
	bg: ThreadReport;
	mt: ThreadReport;
	net?: NetReport;
}

/** The source of each core-js check, by module: a "wrong" note quotes the failing one. */
export type CheckSources = Record<string, string[]>;

// The parameters lynx-core's wrapper gives the background's script
// (@lynx-js/runtime-wrapper-webpack-plugin 0.2.6, defaultInjectVars; the binding renames Card,
// Component, ReactLynx and Behavior, and self and navigator).
const WRAPPER_PARAMS = new Set(
	"setTimeout setInterval clearInterval clearTimeout NativeModules tt console nativeAppId LynxJSBI lynx window document frames self location navigator localStorage history Caches screen alert confirm prompt fetch XMLHttpRequest __WebSocket__ webkit Reporter print global requestAnimationFrame cancelAnimationFrame".split(
		" ",
	),
);

/**
 * What the binding (@sohedra/lynx) fills itself, for Svelte's runtime, by thread, with the native
 * name a real one would have (packages/lynx/src/{background,main-thread}/engine-gaps.ts):
 * `queueMicrotask`, `EventTarget`, `structuredClone` and `replaceAll` on both, `performance` (only
 * `now` and `timeOrigin`) on the background, and the main thread's copy of `lynx.SystemInfo`. A
 * column says "no" for each: the engine lacks it.
 */
export const BINDING_FILLS: Readonly<
	Record<ColumnThread, Readonly<Record<string, string | null>>>
> = {
	bg: {
		queueMicrotask: "queueMicrotask",
		EventTarget: "EventTarget",
		structuredClone: "structuredClone",
		performance: "performance",
	},
	mt: {
		queueMicrotask: "queueMicrotask",
		EventTarget: "EventTarget",
		structuredClone: "structuredClone",
		SystemInfo: null,
	},
};

// A core-js module whose check fails, and the diagnostic rows that say why.
const WHY: Record<string, string[]> = {
	"es.object.assign": [
		"why.object.assign.getter-defines",
		"why.object.assign.symbols",
		"why.object.assign.order",
	],
	"es.object.get-own-property-descriptor": ["why.object.gopd.primitive"],
	"es.reflect.apply": ["why.reflect.apply.no-args"],
	"es.string.match-all": ["why.string.match-all.non-global"],
	"es.string.replace": [
		"why.string.replace.symbol-replace-object",
		"why.string.replace.calls-exec",
		"why.string.replace.named-groups-from-exec",
		"why.string.replace.dollar-zero",
		"why.string.replace.symbol-dollar-zero",
	],
	"es.promise": ["why.promise.species", "why.promise.species-getter", "why.promise.subclass"],
	"es.promise.all-settled": ["why.promise.species"],
	"es.promise.finally": ["why.promise.species"],
	"es.promise.any": ["why.promise.species"],
	"es.json.stringify": ["why.json.stringify.well-formed", "why.json.stringify.symbol"],
	"es.json.parse": ["why.json.parse.source"],
	"es.error.cause": ["x.error.cause.option", "why.error.cause.in-prototype"],
	"es.aggregate-error.cause": ["why.aggregate-error.cause"],
};

// core-js checks the production build's minifier miscompiles, so their failure says nothing about
// the engine: each condition is checked on its own by the WHY rows instead. es.string.replace: SWC
// folds `/./[Symbol.replace]('a', '$0') === '$0'` to `0`; unminified, the same check passes on host
// PrimJS 4.2.
const MINIFIER_FOLDED: Record<string, string> = {
	"es.string.replace":
		"core-js's check is miscompiled by the build's minifier (it folds `/./[Symbol.replace]('a', '$0') === '$0'` to 0); each of its five conditions passes on its own",
};

/** What each status means. */
export const STATUSES: Readonly<Record<Status, string>> = {
	yes: "there, and its check gives the specified result",
	no: "missing (or only the binding's fill)",
	wrong: "there, but its check fails",
	param:
		"background only as a lynx-core wrapper parameter: the free name works, globalThis lacks it",
};

/** A value the probe recorded, as text: the probe records strings, numbers, booleans and null. */
function asText(value: unknown): string {
	// Boundary: a recorded value, one of the primitives the probe writes.
	return typeof value === "string" ? value : String(value as number | boolean | null | undefined);
}

/** `value` as text, cut at `length`. */
function short(value: unknown, length = 90): string {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return text !== undefined && text.length > length ? `${text.slice(0, length)}…` : text;
}

/** The smoke checks that failed, each as "label: got (want expected)". */
function failedSmokes(smoke: Record<string, Smoke>): string[] {
	return Object.entries(smoke)
		.filter(([, check]) => check.expected !== undefined && !check.ok)
		.map(
			([label, check]) => `${label}: ${short(check.got, 70)} (want ${short(check.expected, 40)})`,
		);
}

/** Whether the probe found the binding's fill in place of `name`, and how it says so. */
function fillOf(thread: ColumnThread, name: string, facts: ThreadReport["facts"]): string | null {
	if (name === "String.prototype.replaceAll") {
		const kind = facts["fill.replaceAll.kind"] ?? "";
		if (kind.startsWith("js ")) return `the binding's fill (its source shows: ${short(kind, 50)})`;
		if (kind.startsWith("native ") && !kind.includes('name="replaceAll"'))
			return `the binding's fill (bytecode, minified name: ${short(kind.split(" ")[1], 20)})`;
		return null;
	}
	if (!(name in BINDING_FILLS[thread])) return null;
	const kind = facts[`fill.${name}.kind`] ?? "";
	if (name === "SystemInfo")
		return thread === "mt" ? "the binding copies lynx.SystemInfo to the global" : null;
	const native = BINDING_FILLS[thread][name];
	if (kind.startsWith("js ")) return `the binding's fill (its source shows: ${short(kind, 50)})`;
	if (kind.startsWith("native ") && !kind.includes(`name="${native}"`))
		return `the binding's fill (bytecode, minified name: ${short(kind.split(" ")[1], 20)})`;
	return null;
}

/** A cell, with the edition its row has. */
type EditionCell = Cell & { edition?: string | undefined };

function builtinCells(
	thread: ColumnThread,
	report: ThreadReport,
	checks: CheckSources,
): Record<string, EditionCell> {
	const rows: Record<string, EditionCell> = {};
	const { extra } = report;
	for (const [key, row] of Object.entries(report.builtins)) {
		let status: Status;
		let note: string;
		if (row.test === "pass" && row.present) {
			status = "yes";
			note = "";
		} else if (!row.present && row.test !== "pass") {
			status = "no";
			note = row.error ? `absent (${short(row.error, 60)})` : "absent";
		} else if (!row.present && row.test === "pass") {
			status = "yes";
			note = "core-js's check passes; the presence read found nothing";
		} else {
			status = "wrong";
			const source = checks[key] ?? checks[`${key}.constructor`];
			const failing =
				source && row.failed !== undefined
					? short(source[row.failed]!.replace(/\s+/g, " "), 110)
					: "";
			const why = (WHY[key] ?? [])
				.filter((name) => extra[name] && !extra[name].ok)
				.map(
					(name) =>
						`${name.replace(/^why\.|^x\./, "")}: got ${short(extra[name]!.got, 50)}, want ${short(extra[name]!.expected, 30)}`,
				);
			note = `present, but core-js's check ${row.failed} ${row.test === "throw" ? `throws ${short(row.error, 60)}` : "fails"}${why.length ? `. ${why.join("; ")}` : failing ? `: ${failing}` : ""}`;
		}
		if (
			status === "wrong" &&
			key in MINIFIER_FOLDED &&
			(WHY[key] ?? []).every((name) => extra[name]?.ok)
		) {
			status = "yes";
			note = MINIFIER_FOLDED[key]!;
		}
		if (key === "es.string.replace-all") {
			const kind = report.facts["fill.replaceAll.kind"] ?? "";
			const filled =
				kind.startsWith("js ") ||
				(kind.startsWith("native ") && !kind.includes('name="replaceAll"'));
			if (filled) {
				note = `engine lacks it; the binding fills it (${short(kind, 40)})`;
				status = "no";
			}
		}
		if (thread === "bg" && key.startsWith("es.promise"))
			note = `${note}${note ? ". " : ""}checked on the bundle's Promise (lynx.Promise)`;
		rows[key] = { status, note, edition: row.edition };
	}
	return rows;
}

function extraCells(report: ThreadReport): Record<string, EditionCell> {
	const rows: Record<string, EditionCell> = {};
	for (const [key, row] of Object.entries(report.extra)) {
		let cell: Cell;
		if (row.ok) cell = { status: "yes", note: "" };
		else if (!row.present) cell = { status: "no", note: `absent (${short(row.got, 60)})` };
		else
			cell = {
				status: "wrong",
				note: `got ${short(row.got, 60)}, want ${short(row.expected, 40)}`,
			};
		rows[key] = { ...cell, edition: row.edition };
	}
	return rows;
}

function syntaxCells(report: ThreadReport): Record<string, EditionCell> {
	const rows: Record<string, EditionCell> = {};
	for (const [key, row] of Object.entries(report.syntax)) {
		if (row.skipped) continue;
		let cell: Cell;
		if (!row.parses)
			cell = {
				status: "no",
				note: `SyntaxError at parse: ${short(asText(row.error).replace(/^SyntaxError: /, ""), 60)}`,
			};
		else if (row.ok) cell = { status: "yes", note: "" };
		else if (asText(row.got).startsWith("THROWS SyntaxError"))
			cell = {
				status: "no",
				note: `parses, then ${short(asText(row.got).replace(/^THROWS /, ""), 60)} when run`,
			};
		else
			cell = {
				status: "wrong",
				note: `got ${short(row.got, 50)}, want ${short(row.expected, 30)}`,
			};
		rows[key] = { ...cell, edition: row.edition };
	}
	return rows;
}

/** Whether a read gave a value. */
const has = (read: unknown): boolean =>
	read !== undefined && read !== "undefined" && !asText(read).startsWith("THROWS");

/** Whether a read of a `lynx` member found nothing: `undefined`, `false` or a throw. */
const nothing = (read: unknown): boolean =>
	read === "undefined" ||
	read === false ||
	asText(read).startsWith("THROWS") ||
	asText(read).startsWith("REJECTS");

/** Whether a smoke check's result says the member is missing, not wrong. */
const missingRead = (read: unknown): boolean =>
	asText(read).includes("not a function") ||
	asText(read).includes("is not defined") ||
	read === "undefined";

function webCells(
	thread: ColumnThread,
	report: ThreadReport,
	net: NetReport | undefined,
): Record<string, Cell> {
	const rows: Record<string, Cell> = {};
	for (const [key, row] of Object.entries(report.web)) {
		const failing = failedSmokes(row.smoke);
		const smokes = Object.values(row.smoke);
		const checked = smokes.filter((check) => check.expected !== undefined).length;
		const recorded = Object.entries(row.smoke)
			.filter(([, check]) => check.expected === undefined)
			.map(([label, check]) => `${label} = ${short(check.got, 70)}`);
		let status: Status;
		let note: string;
		const { free, glob } = row;
		if (
			free === undefined &&
			key.startsWith("lynx.") &&
			smokes.every((check) => nothing(check.got))
		) {
			[status, note] = ["no", "lynx has no such member on this thread"];
		} else if (free === undefined) {
			// A member row: only its checks.
			const anyThere = smokes.some(
				(check) => !asText(check.got).startsWith("THROWS") && check.got !== "undefined",
			);
			if (checked === 0 || failing.length === 0) [status, note] = ["yes", recorded.join("; ")];
			else if (!anyThere || smokes.every((check) => missingRead(check.got)))
				[status, note] = ["no", failing.join("; ")];
			else [status, note] = ["wrong", failing.join("; ")];
		} else if (!has(free) && !has(glob)) {
			status = "no";
			note =
				thread === "bg" && WRAPPER_PARAMS.has(key)
					? "a wrapper parameter bound to undefined: reading a member is a TypeError, not a ReferenceError"
					: "";
		} else if (thread === "bg" && has(free) && !has(glob) && WRAPPER_PARAMS.has(key)) {
			status = "param";
			note = failing.length
				? `free name works, globalThis lacks it; failing: ${failing.join("; ")}`
				: "free name works, globalThis lacks it";
		} else if (failing.length === 0) {
			status = "yes";
			note = "";
		} else if (
			checked > 0 &&
			failing.length === checked &&
			smokes.every((check) => check.expected === undefined || missingRead(check.got))
		) {
			status = "wrong";
			note = `present but hollow: ${failing.join("; ")}`;
		} else {
			status = "wrong";
			note = failing.join("; ");
		}
		if (free !== undefined && thread === "bg" && has(free) !== has(glob) && status !== "param")
			note = `${note}${note ? ". " : ""}free: ${free}, globalThis: ${glob}`;
		const fill = fillOf(thread, key, report.facts);
		if (fill) {
			note = `engine lacks it; ${fill}${failing.length ? `; the fill fails ${failing.join("; ")}` : ""}`;
			status = "no";
		}
		if (
			key === "ReadableStream" &&
			status === "yes" &&
			report.async["ReadableStream.read"] === "pending"
		) {
			status = "wrong";
			note =
				"a stream made with new ReadableStream({ start(c) { c.enqueue('a'); c.close(); } }): getReader().read() never settles (see async.ReadableStream.read)";
		}
		const eventSource = net?.["event-source"];
		if (
			key === "lynx.EventSource" &&
			status === "yes" &&
			eventSource &&
			typeof eventSource === "object" &&
			!eventSource.seen.some((seen) => /^(message|custom)/.test(seen))
		) {
			status = "wrong";
			note = `against a standard text/event-stream server it opens, delivers no event, then errors: ${short(eventSource.seen.map((seen) => seen.replace(/@\d+$/, "")).join(", "), 120)}`;
		}
		if (key === "global")
			note = `the bundler rewrites a free \`global\` to its own runtime global (__webpack_require__.g)${note ? `; ${note}` : ""}`;
		if (recorded.length && status !== "yes")
			note = `${note}${note ? ". " : ""}${recorded.join("; ")}`;
		rows[key] = { status, note };
	}
	return rows;
}

function asyncCells(report: ThreadReport): Record<string, Cell> {
	const rows: Record<string, Cell> = {};
	for (const [key, value] of Object.entries(report.async)) {
		const text = asText(value);
		let status: Status = "yes";
		if (text.startsWith("THROWS") || text.startsWith("REJECTS"))
			status = /not a function|is not defined|not a constructor/.test(text) ? "no" : "wrong";
		if (text === "pending") status = "wrong";
		rows[`async.${key}`] = {
			status,
			note:
				text === "pending"
					? `never settled within ${report.asyncState?.replace("timed out at ", "") ?? "2 s"}`
					: status === "yes"
						? `= ${short(value, 60)}`
						: short(text, 90),
		};
	}
	return rows;
}

/** A thread's `SystemInfo`, as its report recorded it. */
function systemInfoOf(report: ThreadReport): Record<string, string | undefined> {
	try {
		// Boundary: the probe recorded `SystemInfo` as JSON text.
		return JSON.parse(report.facts["SystemInfo"] ?? "") as Record<string, string | undefined>;
	} catch {
		return {};
	}
}

/** The group a row id belongs to. */
function groupOf(id: string): string {
	if (id.startsWith("es.")) return "built-ins (core-js modules)";
	if (id.startsWith("x.")) return "built-ins (no core-js module)";
	if (id.startsWith("why.")) return "diagnostics (why a check fails)";
	if (id.startsWith("syn.")) return "syntax";
	if (id.startsWith("async.")) return "async checks";
	return "web APIs";
}

/** Makes the feature table from the probe's runs. */
export function makeTable(
	runs: readonly Run[],
	options: { generated: string; checks?: CheckSources },
): FeatureTable {
	const checks = options.checks ?? {};
	const columns = new Map<string, Column>();
	const perColumnRuns = new Map<string, { run: string; cells: Record<string, EditionCell> }[]>();
	for (const { name, bg, mt, net } of runs) {
		const info = systemInfoOf(bg);
		for (const [thread, report] of [
			["mt", mt],
			["bg", bg],
		] as const) {
			const own = systemInfoOf(report);
			const engineVersion = own["engineVersion"] ?? info["engineVersion"];
			const lynxSdkVersion = own["lynxSdkVersion"] ?? info["lynxSdkVersion"];
			const platform = asText(own["platform"] ?? info["platform"]).toLowerCase();
			const id = `primjs-${engineVersion}-lynx-${lynxSdkVersion}-${platform}-${thread}`;
			let column = columns.get(id);
			if (!column) {
				column = {
					id,
					engine: info["runtimeType"] === "quickjs" ? "primjs" : info["runtimeType"],
					engineVersion,
					lynxSdkVersion,
					platform,
					thread,
					osVersion: info["osVersion"],
					runtimeType: info["runtimeType"],
					systemInfo: report.facts["SystemInfo"],
					lepusVersion: report.facts["__lepus_version__"],
					runs: [],
				};
				columns.set(id, column);
			}
			column.runs.push(name);
			const cells = {
				...builtinCells(thread, report, checks),
				...extraCells(report),
				...syntaxCells(report),
				...webCells(thread, report, thread === "bg" ? net : undefined),
				...asyncCells(report),
			};
			const list = perColumnRuns.get(id) ?? [];
			list.push({ run: name, cells });
			perColumnRuns.set(id, list);
		}
	}

	const rowMeta = new Map<string, Omit<Row, "cells">>();
	for (const list of perColumnRuns.values())
		for (const [id, cell] of Object.entries(list[0]!.cells))
			if (!rowMeta.has(id))
				rowMeta.set(id, { id, group: groupOf(id), edition: cell.edition ?? "" });

	const variance: Variance[] = [];
	const rows: Row[] = [];
	for (const meta of rowMeta.values()) {
		const cells: Record<string, Cell> = {};
		for (const [column, list] of perColumnRuns) {
			const first = list[0]!.cells[meta.id];
			if (!first) continue;
			const seen = list.flatMap((entry) => entry.cells[meta.id] ?? []);
			const differs = seen.some((cell) => cell.status !== first.status || cell.note !== first.note);
			cells[column] = { status: first.status, note: first.note };
			if (differs) {
				variance.push({
					row: meta.id,
					column,
					values: list.map((entry) => {
						const cell = entry.cells[meta.id];
						return { run: entry.run, ...(cell && { status: cell.status, note: cell.note }) };
					}),
				});
				cells[column].note =
					`${first.note}${first.note ? ". " : ""}[varied between runs: ${[...new Set(seen.map((cell) => cell.status))].join("/")}]`;
			}
		}
		rows.push({ ...meta, cells });
	}

	return {
		generated: options.generated,
		statuses: { ...STATUSES },
		columns: [...columns.values()],
		rows,
		variance,
	};
}

/** Text for a Markdown table's cell. */
const escapeCell = (text: unknown): string =>
	asText(text ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ");

/** The table as Markdown, one section a group. */
export function renderMarkdown(table: FeatureTable, runCount: number): string {
	const columns = table.columns;
	const lines: string[] = [];
	lines.push("# Feature table", "");
	lines.push(`Generated ${table.generated} by make-table.ts from ${runCount} run(s).`, "");
	lines.push("Columns:", "");
	for (const column of columns)
		lines.push(
			`- \`${column.id}\`: ${column.thread === "mt" ? "main thread" : "background"}, runtimeType ${column.runtimeType}, osVersion ${column.osVersion}; runs ${column.runs.join(", ")}`,
		);
	lines.push(
		"",
		`Statuses: ${Object.entries(table.statuses)
			.map(([status, meaning]) => `**${status}** ${meaning}`)
			.join("; ")}.`,
		"",
	);
	lines.push(`Cells that varied between runs: ${table.variance.length}.`, "");
	for (const group of new Set(table.rows.map((row) => row.group))) {
		lines.push(`## ${group}`, "");
		lines.push(`| Row | Edition | ${columns.map((column) => `\`${column.id}\``).join(" | ")} |`);
		lines.push(`| --- | --- | ${columns.map(() => "---").join(" | ")} |`);
		for (const row of table.rows.filter((entry) => entry.group === group))
			lines.push(
				`| \`${row.id}\` | ${escapeCell(row.edition)} | ${columns
					.map((column) => {
						const cell = row.cells[column.id];
						return cell ? `${cell.status}${cell.note ? `: ${escapeCell(cell.note)}` : ""}` : "";
					})
					.join(" | ")} |`,
			);
		lines.push("");
	}
	return lines.join("\n");
}

/** Reads one run's folder. */
export function readRun(folder: string): Run {
	const read = (file: string): unknown =>
		JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
	const netFile = path.join(folder, "net.json");
	// Boundary: the probe's reports are JSON in these shapes.
	return {
		name: path.basename(folder),
		bg: read("bg.json") as ThreadReport,
		mt: (read("ft-mt.json") as { value: { mt: ThreadReport } }).value.mt,
		...(fs.existsSync(netFile) && { net: read("net.json") as NetReport }),
	};
}

/** The command line: writes feature-table.json and feature-table.md for the runs it is given. */
function main(args: string[]): void {
	const option = (name: string): string | undefined => {
		const index = args.indexOf(name);
		return index === -1 ? undefined : args.splice(index, 2)[1];
	};
	const out = option("--out") ?? ".";
	const checksFile = option("--checks");
	const runs = args.map(readRun);
	const table = makeTable(runs, {
		generated: new Date().toISOString(),
		// Boundary: the check sources are JSON in this shape.
		...(checksFile && {
			checks: JSON.parse(fs.readFileSync(checksFile, "utf8")) as CheckSources,
		}),
	});
	fs.mkdirSync(out, { recursive: true });
	fs.writeFileSync(path.join(out, "feature-table.json"), `${JSON.stringify(table, null, "\t")}\n`);
	fs.writeFileSync(path.join(out, "feature-table.md"), `${renderMarkdown(table, runs.length)}\n`);
	console.log(
		`columns ${table.columns.map((column) => column.id).join(", ")}; rows ${table.rows.length}; varied cells ${table.variance.length}`,
	);
}

if (import.meta.main) main(process.argv.slice(2));
