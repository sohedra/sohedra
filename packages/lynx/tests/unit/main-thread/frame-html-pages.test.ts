// The first frame's parser on the pages the thread tests draw: the tree it reads, ids included, is
// pinned, so that a change to how it reads the markup keeps what it reads.

import { describe, expect, it } from "@rstest/core";

import { readGlobal } from "../../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";
import drawCssVariables from "../../fixtures/threads/CssVariables.svelte?first-frame";
import drawDeferredNested from "../../fixtures/threads/DeferredNested.svelte?first-frame";
import drawDeferredRows from "../../fixtures/threads/DeferredRows.svelte?first-frame";
import drawEmptyClassSpread from "../../fixtures/threads/EmptyClassSpread.svelte?first-frame";
import drawFrameAttributes from "../../fixtures/threads/FrameAttributes.svelte?first-frame";
import drawFrameBlocks from "../../fixtures/threads/FrameBlocks.svelte?first-frame";
import drawFrameBranchList from "../../fixtures/threads/FrameBranchList.svelte?first-frame";
import drawFrameCounter from "../../fixtures/threads/FrameCounter.svelte?first-frame";
import drawFrameEvents from "../../fixtures/threads/FrameEvents.svelte?first-frame";
import drawFrameFeed from "../../fixtures/threads/FrameFeed.svelte?first-frame";
import drawFrameIdBranches from "../../fixtures/threads/FrameIdBranches.svelte?first-frame";
import drawFrameIdDeferred from "../../fixtures/threads/FrameIdDeferred.svelte?first-frame";
import drawFrameIds from "../../fixtures/threads/FrameIds.svelte?first-frame";
import drawFrameList from "../../fixtures/threads/FrameList.svelte?first-frame";
import drawFrameMarkupValue from "../../fixtures/threads/FrameMarkupValue.svelte?first-frame";
import drawFrameTextInBlock from "../../fixtures/threads/FrameTextInBlock.svelte?first-frame";
import drawFrameTexts from "../../fixtures/threads/FrameTexts.svelte?first-frame";
import drawHydrate from "../../fixtures/threads/functions/Hydrate.svelte?first-frame";
import drawInitialRows from "../../fixtures/threads/InitialRows.svelte?first-frame";
import drawInitialRowsNested from "../../fixtures/threads/InitialRowsNested.svelte?first-frame";
import drawInitialRowsSnippet from "../../fixtures/threads/InitialRowsSnippet.svelte?first-frame";
import drawInitialRowsTwoLists from "../../fixtures/threads/InitialRowsTwoLists.svelte?first-frame";
import drawLongFeed from "../../fixtures/threads/LongFeed.svelte?first-frame";
import drawStaticCards from "../../fixtures/threads/StaticCards.svelte?first-frame";
import { drawnTree } from "./drawn-tree.ts";

type Draw = (props?: Record<string, unknown>) => void;

/** The pages, each a first-frame copy and the props it draws with. */
const PAGES: [name: string, draw: Draw, props: Record<string, unknown>][] = [
	["CssVariables", drawCssVariables, {}],
	["DeferredNested", drawDeferredNested, { rows: ["a", "b"] }],
	["DeferredRows", drawDeferredRows, { handles: {} }],
	["EmptyClassSpread", drawEmptyClassSpread, { tone: "" }],
	["InitialRows", drawInitialRows, { handles: {} }],
	["InitialRowsNested", drawInitialRowsNested, {}],
	["InitialRowsSnippet", drawInitialRowsSnippet, {}],
	["InitialRowsTwoLists", drawInitialRowsTwoLists, {}],
	["FrameAttributes", drawFrameAttributes, {}],
	["FrameBlocks", drawFrameBlocks, { tone: "drawn", log: [] }],
	["FrameBranchList", drawFrameBranchList, {}],
	["FrameCounter", drawFrameCounter, { parity: "drawn" }],
	["FrameEvents", drawFrameEvents, { log: [] }],
	["FrameFeed", drawFrameFeed, {}],
	["FrameIdBranches", drawFrameIdBranches, {}],
	["FrameIdDeferred", drawFrameIdDeferred, {}],
	["FrameIds", drawFrameIds, {}],
	["FrameList", drawFrameList, { rows: ["a", "b", "c"], log: [] }],
	["FrameMarkupValue", drawFrameMarkupValue, {}],
	["FrameTextInBlock", drawFrameTextInBlock, {}],
	["FrameTexts", drawFrameTexts, {}],
	["Hydrate", drawHydrate, { log: [], api: {} }],
	["LongFeed plain", drawLongFeed, { count: 3, shape: "plain" }],
	["LongFeed row", drawLongFeed, { count: 3, shape: "row" }],
	["StaticCards", drawStaticCards, { count: 2 }],
];

describe("the first frame's parser, on the pages the thread tests draw", () => {
	it.each(PAGES)("reads %s as before", (_name, draw, props) => {
		draw(props);
		const markup = (readGlobal(FIRST_FRAME_GLOBAL) as (data: object) => string)({});
		expect(drawnTree(markup)).toMatchSnapshot();
	});
});
