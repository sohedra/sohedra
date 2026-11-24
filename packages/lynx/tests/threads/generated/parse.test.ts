// The first frame's parser on generated pages: the tree it reads from each page's markup, ids
// included, is pinned for a fixed set of pages, so that a change to how it reads the markup keeps
// what it reads. The other generated tests check the tree against the background's.

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { readGlobal, removeGlobals } from "../../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import drawGeneratedFrame from "../../fixtures/threads/GeneratedFrame.svelte?first-frame";
import { drawnTree } from "../../unit/main-thread/drawn-tree.ts";
import { compilePage } from "./compile.ts";
import { pageModel } from "./grammar.ts";
import { pageSources } from "./source.ts";

/** The pages: as many, from the same seed, on every run. */
const PAGES = fc.sample(pageModel, { seed: 2026, numRuns: 24 });

describe("the first frame's parser, on generated pages", () => {
	it("reads each page as before", async () => {
		const trees: string[] = [];
		for (const model of PAGES) {
			const compiled = await compilePage(pageSources(model), { production: model.production });
			// A main thread records one page's first frame: the one drawn before goes first.
			removeGlobals([FIRST_FRAME_GLOBAL]);
			drawGeneratedFrame({
				page: compiled.mainThread,
				props: { data: structuredClone(model.data), handles: {} },
				ids: { recordId: () => undefined },
			});
			const markup = (readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({});
			trees.push(drawnTree(markup));
		}
		expect(trees).toMatchSnapshot();
	}, 60_000);
});
