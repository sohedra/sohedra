import { describe, expect, it } from "@rstest/core";

import {
	readWorkarounds,
	scanRepository,
	workaroundList,
} from "../../../../../scripts/workarounds.ts";

const REPO = new URL("../../../../../", import.meta.url).pathname;

/** The problems found in one source file, the lines joined with newlines. */
const problems = (...lines: string[]): string[] =>
	readWorkarounds("file.ts", lines.join("\n")).problems;
const found = (...lines: string[]) => readWorkarounds("file.ts", lines.join("\n")).workarounds;

describe("a workaround tag", () => {
	it("is read from a one-line doc comment", () => {
		expect(
			found(
				'/** @workaround proxy-accessor-setter kind=lynx-bug delete-when="Lynx calls a setter" */',
			),
		).toEqual([
			{
				name: "proxy-accessor-setter",
				kind: "lynx-bug",
				deleteWhen: "Lynx calls a setter",
				file: "file.ts",
				line: 1,
			},
		]);
	});

	it("is read across the lines of a doc comment, with its upstream link", () => {
		const [tag] = found(
			"/**",
			" * @workaround short-css-import kind=lynx-limit",
			" *   upstream=https://github.com/lynx-family/lynx/issues/1",
			' *   delete-when="the engine accepts long identifiers"',
			" */",
		);
		expect(tag).toMatchObject({
			name: "short-css-import",
			kind: "lynx-limit",
			upstream: "https://github.com/lynx-family/lynx/issues/1",
			deleteWhen: "the engine accepts long identifiers",
			line: 2,
		});
	});

	it("is read from a line comment", () => {
		expect(
			found('// @workaround no-is-selector kind=lynx-gap delete-when="Lynx documents :is()"'),
		).toHaveLength(1);
	});

	it("is not read from a string, or from the middle of a comment", () => {
		expect(found('const text = "/** @workaround a kind=lynx-bug delete-when=x */";')).toEqual([]);
		expect(found("/** Mentions a workaround tag, but is not one. */")).toEqual([]);
	});

	it("needs a name in lower-case words joined by hyphens", () => {
		expect(problems('/** @workaround kind=lynx-bug delete-when="x" */')[0]).toContain("name");
		expect(problems('/** @workaround Bad_Name kind=lynx-bug delete-when="x" */')[0]).toContain(
			"Bad_Name",
		);
	});

	it("needs a kind from the list", () => {
		expect(problems('/** @workaround a-b delete-when="x" */')[0]).toContain("kind");
		expect(problems('/** @workaround a-b kind=other delete-when="x" */')[0]).toContain("other");
		for (const kind of ["lynx-limit", "lynx-bug", "lynx-gap", "svelte-internal", "tooling"]) {
			expect(problems(`/** @workaround a-b kind=${kind} delete-when="x" */`)).toEqual([]);
		}
	});

	it("needs a delete-when in words", () => {
		expect(problems("/** @workaround a-b kind=tooling */")[0]).toContain("delete-when");
		expect(problems('/** @workaround a-b kind=tooling delete-when="" */')[0]).toContain(
			"delete-when",
		);
	});

	it("takes only an https upstream link", () => {
		expect(
			problems('/** @workaround a-b kind=tooling upstream=#12 delete-when="x" */')[0],
		).toContain("upstream");
	});

	it("takes no other key, and no repeated one", () => {
		expect(problems('/** @workaround a-b kind=tooling why=x delete-when="x" */')[0]).toContain(
			"why",
		);
		expect(
			problems('/** @workaround a-b kind=tooling kind=lynx-bug delete-when="x" */')[0],
		).toContain("kind");
	});

	it("names the file and line of a problem", () => {
		expect(problems("", "// @workaround a-b")[0]).toContain("file.ts:2");
	});
});

describe("the list", () => {
	it("has one row per workaround, by name, with where it is and when it goes", () => {
		const list = workaroundList([
			{ name: "b-one", kind: "tooling", deleteWhen: "later", file: "b.ts", line: 4 },
			{
				name: "a-one",
				kind: "lynx-bug",
				deleteWhen: "Lynx fixes it",
				upstream: "https://example.com/issue",
				file: "a.ts",
				line: 2,
			},
		]);
		const rows = list.split("\n").filter((line) => line.startsWith("| `"));
		expect(rows).toHaveLength(2);
		expect(rows[0]).toContain("a-one");
		expect(rows[0]).toContain("a.ts:2");
		expect(rows[0]).toContain("https://example.com/issue");
		expect(rows[0]).toContain("Lynx fixes it");
		expect(rows[1]).toContain("b-one");
	});
});

describe("the repository", () => {
	it("has well-formed tags with distinct names", () => {
		expect(scanRepository(REPO).problems).toEqual([]);
	});
});
