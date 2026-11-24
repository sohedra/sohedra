// The feature table (scripts/feature-table/): the generator makes each cell from a run's reports,
// and every row a Lynx thread lacks or gets wrong is answered (fills.ts): by an import of the
// package, by Sohedra's binding, or with why nothing fills it. Every import answers at least one
// row, so the fill list and the measured table can't drift apart.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { ANSWERS } from "../../scripts/feature-table/fills.ts";
import {
	BINDING_FILLS,
	makeTable,
	renderMarkdown,
} from "../../scripts/feature-table/make-table.ts";
import type { FeatureTable, Run, ThreadReport } from "../../scripts/feature-table/make-table.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

// Boundary: JSON has no type; the generator wrote these shapes.
const table = JSON.parse(
	fs.readFileSync(path.join(ROOT, "scripts/feature-table/feature-table.json"), "utf8"),
) as FeatureTable;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
	exports: Record<string, unknown>;
};

/** The package's imports, `""` for the whole baseline. */
const IMPORTS = Object.keys(manifest.exports)
	.filter((key) => key !== "./package.json")
	.map((key) => key.slice(1));

/** The rows some thread lacks or gets wrong. */
const lacking = table.rows
	.filter((row) => Object.values(row.cells).some((cell) => ["no", "wrong"].includes(cell.status)))
	.map((row) => row.id);

describe("the committed table", () => {
	it("has columns, rows and a cell of a known status for each column", () => {
		expect(table.columns.length).toBeGreaterThan(0);
		expect(table.rows.length).toBeGreaterThan(400);
		for (const row of table.rows)
			for (const cell of Object.values(row.cells))
				expect(Object.keys(table.statuses), row.id).toContain(cell.status);
		expect(table.variance).toEqual([]);
	});
});

describe("the answers to what Lynx lacks", () => {
	it("answer every row a thread lacks or gets wrong", () => {
		expect(lacking.filter((id) => !(id in ANSWERS))).toEqual([]);
	});

	it("each name a row a thread lacks or gets wrong", () => {
		expect(Object.keys(ANSWERS).filter((id) => !lacking.includes(id))).toEqual([]);
	});

	it("name only imports the package has, and every import answers a row", () => {
		const named = new Set(
			Object.values(ANSWERS).flatMap((answer) => ("fills" in answer ? answer.fills : [])),
		);
		expect([...named].filter((name) => !IMPORTS.includes(name))).toEqual([]);
		expect(IMPORTS.filter((name) => !named.has(name))).toEqual([]);
	});

	it("give the binding only what it fills", () => {
		const binding = new Set([
			...Object.keys(BINDING_FILLS.bg),
			...Object.keys(BINDING_FILLS.mt),
			"String.prototype.replaceAll",
			"es.string.replace-all",
		]);
		const claimed = Object.entries(ANSWERS)
			.filter(([, answer]) => "binding" in answer && answer.binding)
			.map(([id]) => id);
		expect(claimed.filter((id) => !binding.has(id))).toEqual([]);
	});
});

/** A thread's report with one row of each kind, as the probe writes them. */
function report(systemInfo: object, overrides: Partial<ThreadReport> = {}): ThreadReport {
	return {
		facts: { SystemInfo: JSON.stringify(systemInfo) },
		builtins: {
			"es.array.at": { edition: "ES2022", present: false, test: "fail" },
			"es.object.assign": { edition: "ES2015 or a fix", present: true, test: "fail", failed: 0 },
		},
		extra: {
			"why.object.assign.getter-defines": { present: true, expected: 1, got: 3, ok: false },
		},
		syntax: {
			"syn.class-static-block": { edition: "ES2022", parses: false, error: "SyntaxError: x" },
		},
		web: {
			URL: {
				free: "function",
				glob: "function",
				smoke: { pathname: { expected: "/p", got: "undefined", ok: false } },
			},
			fetch: { free: "function", glob: "undefined", smoke: {} },
		},
		async: { "bundle.try": "THROWS TypeError: t.try is not a function" },
		...overrides,
	};
}

describe("the generator", () => {
	const info = { platform: "Android", lynxSdkVersion: "4.2", engineVersion: "4.2" };
	const runs: Run[] = ["run1", "run2"].map((name) => ({
		name,
		bg: report({ ...info, runtimeType: "quickjs", osVersion: "36" }),
		mt: report(info),
	}));
	const made = makeTable(runs, { generated: "now" });

	it("names a column by its engine, Lynx version, platform and thread, with its runs", () => {
		expect(made.columns.map((column) => [column.id, column.runs])).toEqual([
			["primjs-4.2-lynx-4.2-android-mt", ["run1", "run2"]],
			["primjs-4.2-lynx-4.2-android-bg", ["run1", "run2"]],
		]);
	});

	it("reads each kind of row into its status and note", () => {
		const cell = (id: string, column = "primjs-4.2-lynx-4.2-android-bg") =>
			made.rows.find((row) => row.id === id)?.cells[column];
		expect(cell("es.array.at")).toEqual({ status: "no", note: "absent" });
		expect(cell("es.object.assign")?.status).toBe("wrong");
		expect(cell("es.object.assign")?.note).toContain("object.assign.getter-defines: got 3, want 1");
		expect(cell("syn.class-static-block")).toEqual({
			status: "no",
			note: "SyntaxError at parse: x",
		});
		expect(cell("URL")).toEqual({
			status: "wrong",
			note: "present but hollow: pathname: undefined (want /p)",
		});
		expect(cell("fetch")).toEqual({
			status: "param",
			note: "free name works, globalThis lacks it",
		});
		expect(cell("fetch", "primjs-4.2-lynx-4.2-android-mt")?.status).toBe("yes");
		expect(cell("async.bundle.try")?.status).toBe("no");
	});

	it("escapes a cell's backslash before its bar, so the bar can't close the Markdown cell", () => {
		const syntax = {
			"syn.class-static-block": { edition: "ES2022", parses: false, error: "a\\|b" },
		};
		const escaped = makeTable(
			runs.map((run) => ({ ...run, bg: { ...run.bg, syntax } })),
			{ generated: "now" },
		);
		const line = renderMarkdown(escaped, 2)
			.split("\n")
			.find((text) => text.startsWith("| `syn.class-static-block`"));
		expect(line).toContain("a\\\\\\|b");
	});

	it("lists a cell that differs between the runs of its column", () => {
		const differing: Run[] = [
			runs[0]!,
			{
				...runs[1]!,
				bg: report({ ...info, runtimeType: "quickjs" }, { async: { "bundle.try": "= 1" } }),
			},
		];
		const { variance, rows } = makeTable(differing, { generated: "now" });
		expect(variance.map((entry) => [entry.row, entry.column])).toEqual([
			["async.bundle.try", "primjs-4.2-lynx-4.2-android-bg"],
		]);
		expect(
			rows.find((row) => row.id === "async.bundle.try")?.cells["primjs-4.2-lynx-4.2-android-bg"]
				?.note,
		).toContain("[varied between runs: no/yes]");
	});
});
