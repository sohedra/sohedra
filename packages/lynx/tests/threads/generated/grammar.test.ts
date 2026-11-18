// The grammar's rules hold for the page as it renders, through snippets and child components: a
// long list renders only at the page level, with no list in its rows, and a list holds at most one
// more. A page that broke them nested tens of thousands of rows and never finished.

import { expect, it } from "@rstest/core";
import fc from "fast-check";

import { pageModel } from "./grammar.ts";
import { check, RUNS, TIMEOUT } from "./settings.ts";
import { pageShape } from "./shape.ts";
import { describeSources, pageSources } from "./source.ts";

/** A page takes milliseconds to make and walk: ten times the pages a rendering property tries. */
const PAGES = RUNS * 10;

it(
	"nests no long list, and no list past a list's item, through snippets and components",
	async () => {
		await check(
			fc.asyncProperty(pageModel, async (page) => {
				const shape = pageShape(page);
				const what = describeSources(pageSources(page));
				expect(shape.longInList, `A long list in a list:\n${what}`).toBe(false);
				expect(shape.listInRow, `A list in a long list's row:\n${what}`).toBe(false);
				expect(shape.deepest, `Lists too deep:\n${what}`).toBeLessThanOrEqual(2);
			}),
			4,
			PAGES,
		);
	},
	TIMEOUT,
);
