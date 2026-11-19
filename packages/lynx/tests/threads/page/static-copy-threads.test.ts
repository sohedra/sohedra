// A static copy on both threads: made in a tap with changes to it, it reaches the main thread in
// one patch, in order, so it is never drawn without them; made in an effect of the first mount, it
// is in the patch that hydrates the first frame; and custom properties set on its root in its own
// tick win over those its `style` carries.

import { describe, expect, it } from "@rstest/core";

import type { ElementNode } from "../../../src/background/renderer/element.ts";
import type { StaticCopy } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import { OpCode } from "../../../src/wire/index.ts";
import type { Op } from "../../../src/wire/index.ts";
import CopyInOneTick from "../../fixtures/threads/page/CopyInOneTick.svelte";
import drawCopyInOneTick from "../../fixtures/threads/page/CopyInOneTick.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

type Results = { copy?: StaticCopy; sizes: unknown[] };

const children = (element: LynxElement) => [...(element as Element).children] as LynxElement[];

async function tap(page: SveltePage, token: string): Promise<void> {
	page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
}

describe("a copy and what is done to it in one tick", () => {
	it("reach the main thread in one patch, in order", async () => {
		const results: Results = { sizes: [] };
		const page = startSveltePage(CopyInOneTick, { props: { results } });
		await page.settle();
		const sent = page.patches.length;
		const flushes = page.engine.flushes.length;
		await tap(page, "go");
		expect(page.patches.length - sent).toBe(1);
		// One flush draws the copy with every change made to it.
		expect(page.engine.flushes.length - flushes).toBe(1);
		const [copy] = children(page.byClass("holder"));
		expect(page.engine.state(copy!).dataset["copied"]).toBe("yes");
		expect(page.engine.state(copy!).inlineStyles.get("opacity")).toBe("0.5");
		// The source shows the later change; the copy shows the text it had at the call.
		expect(page.engine.texts()).toEqual(["b", "a"]);
		const items = page.patches.at(-1)!.items;
		const ops = items.flatMap((item) => (item[0] === "ops" ? (item[1] as Op[]) : []));
		// Boundary: the test reads the renderer's own id of the node.
		const id = (results.copy!.nodes[0] as unknown as ElementNode).lynxId;
		const at = (match: (op: Op) => boolean) => ops.findIndex(match);
		const created = at((op) => op[0] === OpCode.Create && op[1] === id);
		const inserted = at((op) => op[0] === OpCode.Insert && op[2] === id);
		const attribute = at(
			(op) => op[0] === OpCode.SetAttr && op[1] === id && op[2] === "data-copied",
		);
		const styled = at((op) => op[0] === OpCode.SetStyles && op[1] === id);
		expect(created).toBeGreaterThanOrEqual(0);
		expect(inserted).toBeGreaterThan(created);
		expect(attribute).toBeGreaterThan(inserted);
		expect(styled).toBeGreaterThan(attribute);
		// The UI call rides after the ops it follows.
		const opsAt = items.findIndex((item) => item[0] === "ops");
		expect(items.findIndex((item) => item[0] === "call")).toBeGreaterThan(opsAt);
		expect(results.sizes).toHaveLength(1);
		expect(page.errors).toEqual([]);
	});

	it("take custom properties set on the copy's root over those its style carries", async () => {
		const results: Results = { sizes: [] };
		const page = startSveltePage(CopyInOneTick, { props: { results } });
		await page.settle();
		await tap(page, "measure");
		const [copy] = children(page.byClass("viewport"));
		const custom = (element: LynxElement, name: string) =>
			page.engine.functions.__GetComputedStyleByKey(element, name);
		expect(custom(page.byClass("popup"), "--popup-width")).toBe("106px");
		expect(custom(copy!, "--popup-width")).toBe("auto");
		expect(custom(copy!, "--popup-height")).toBe("auto");
		expect(custom(children(copy!)[0]!, "--popup-width")).toBe("auto");
		expect(page.engine.state(copy!).inlineStyles.get("position")).toBe("relative");
		expect(page.errors).toEqual([]);
	});
});

describe("a copy made in an effect of the first mount", () => {
	it("is in the patch that hydrates the first frame, which keeps every element it drew", async () => {
		const results: Results = { sizes: [] };
		const page = startSveltePage(CopyInOneTick, {
			props: { results, onMount: true },
			firstFrame: { draw: drawCopyInOneTick, props: { results: { sizes: [] }, onMount: true } },
		});
		const drawn = page.engine.all();
		const holder = page.byClass("holder");
		expect(children(holder)).toEqual([]);
		await page.settle();
		expect(page.patches).toHaveLength(1);
		const now = page.engine.all();
		expect(now).toEqual(expect.arrayContaining(drawn));
		// Only the copy is new: a view, its text, and the text's raw text.
		expect(now).toHaveLength(drawn.length + 3);
		expect(page.byClass("holder")).toBe(holder);
		const [copy] = children(holder);
		expect(page.engine.state(copy!).id).toBeNull();
		page.asBackground(() => results.copy!.remove());
		await page.settle();
		expect(children(holder)).toEqual([]);
		expect(page.errors).toEqual([]);
	});
});
