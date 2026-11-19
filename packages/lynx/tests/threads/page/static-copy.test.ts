// `createStaticCopy`: a lifeless copy of drawn elements, put into an empty element Svelte rendered.
// What a copy carries and leaves out, `keepIds`, the errors, a container that already holds copies,
// each `remove()`, a container Svelte removes, and that a copy is a node like any other. An object
// attribute of a copy is its own: changing one changes nothing of the other.

import { describe, expect, it, rs } from "@rstest/core";

import type { ElementNode } from "../../../src/background/renderer/element.ts";
import type { TreeNode } from "../../../src/background/renderer/node.ts";
import { pageRenderer } from "../../../src/background/renderer/page-renderer.ts";
import { createStaticCopy } from "../../../src/background/root-entry.ts";
import type { StaticCopy } from "../../../src/background/root-entry.ts";
import type { LynxElement } from "../../../src/testing/index.ts";
import CopySource from "../../fixtures/threads/page/CopySource.svelte";
import drawCopySource from "../../fixtures/threads/page/CopySource.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

type Handles = Record<string, ElementNode> & { taps: number; hideHolder(): void };

async function source(props: Record<string, unknown> = {}) {
	// Boundary: the fixture fills the nodes in as it renders.
	const handles = { taps: 0 } as unknown as Handles;
	// The source's first-frame copy registers its main-thread handler; no frame is drawn.
	void drawCopySource;
	const page = startSveltePage(CopySource, { props: { handles, ...props } });
	await page.settle();
	/** Runs `change` on the background, and waits for the main thread. */
	const act = async <T>(change: () => T): Promise<T> => {
		const result = page.asBackground(change);
		await page.settle();
		return result;
	};
	const state = (element: LynxElement) => page.engine.state(element);
	const children = (element: LynxElement) => [...(element as Element).children] as LynxElement[];
	const firstClass = (element: LynxElement) => state(element).classes.split(" ")[0];
	return { page, handles, act, state, children, firstClass };
}

/** The kinds of the nodes under `node`, as the renderer holds them. */
function kinds(node: TreeNode): string[] {
	const found: string[] = [];
	for (let child = node.first; child; child = child.next) found.push(child.kind);
	return found;
}

/** What `run` throws. */
function thrownBy(run: () => unknown): { code?: string; message?: string } {
	try {
		run();
	} catch (error) {
		return error as { code?: string; message?: string };
	}
	throw new Error("It threw nothing.");
}

describe("a static copy", () => {
	it("copies an element with everything under it, as it is at the call", async () => {
		const { page, handles, act, state, children } = await source();
		const copy = await act(() => createStaticCopy(handles["source"]!, handles["holder"]!));
		expect(copy.nodes.map((node) => node.tag)).toEqual(["view"]);
		const [copied] = children(page.byClass("holder"));
		const original = page.byClass("source");
		expect(state(copied!).classes).toMatch(/^source svelte-\w+$/);
		expect(state(copied!).classes).toBe(state(original).classes);
		expect(state(copied!).inlineStyles).toEqual(state(original).inlineStyles);
		expect(state(copied!).dataset).toEqual({
			kind: "card",
			tone: "calm",
			shape: { corners: [4, 8], kind: "card" },
		});
		expect(state(copied!).attrs).toMatchObject({
			"aria-label": "Source",
			"accessibility-element": true,
		});
		expect(children(copied!).map((child) => state(child).tag)).toEqual(["text", "image", "view"]);
		expect(page.engine.text(copied!)).toBe("TitleDeep");
		expect(state(children(copied!)[1]!).attrs["src"]).toBe("https://example.test/picture.png");
		expect(state(children(copied!)[2]!).dataset).toEqual({ depth: 2 });
		expect(page.engine.texts().filter((text) => text === "Title")).toHaveLength(2);
		expect(page.errors).toEqual([]);
	});

	it("keeps what it had at the call when the source changes", async () => {
		const { page, handles, act, state, children } = await source();
		const copy = await act(() => createStaticCopy(handles["source"]!, handles["other"]!));
		await act(() => handles["source"]!.setAttribute("data-tone", "loud"));
		expect(state(page.byClass("source")).dataset["tone"]).toBe("loud");
		expect(state(children(page.byClass("other"))[0]!).dataset["tone"]).toBe("calm");
		expect(copy.nodes[0]!.getAttribute("data-tone")).toBe("calm");
	});

	it("has object attributes of its own, not the source's", async () => {
		const { handles, act } = await source();
		const copy = await act(() => createStaticCopy(handles["source"]!, handles["holder"]!));
		const mine = copy.nodes[0]!.getAttribute("data-shape") as { corners: number[] };
		const theirs = handles["source"]!.getAttribute("data-shape") as { corners: number[] };
		expect(mine).toEqual(theirs);
		expect(mine).not.toBe(theirs);
		expect(mine.corners).not.toBe(theirs.corners);
		mine.corners.push(16);
		expect(theirs.corners).toEqual([4, 8]);
	});

	it("copies a list of nodes, in order, and none from an empty list", async () => {
		const { page, handles, act, children, firstClass } = await source();
		const copy = await act(() =>
			createStaticCopy([handles["title"]!, handles["source"]!], handles["holder"]!),
		);
		expect(copy.nodes.map((node) => node.tag)).toEqual(["text", "view"]);
		expect(children(page.byClass("holder")).map(firstClass)).toEqual(["title", "source"]);
		expect(await act(() => createStaticCopy([], handles["other"]!).nodes)).toEqual([]);
	});

	it("leaves out listeners, main-thread attributes and the nodes Svelte keeps its place with", async () => {
		const { page, handles, act, state, children } = await source();
		const copy = await act(() => createStaticCopy(handles["source"]!, handles["holder"]!));
		const root = copy.nodes[0]!;
		expect(root.getAttributeNames().filter((name) => name.startsWith("main-thread:"))).toEqual([]);
		const copied = children(page.byClass("holder"))[0]!;
		expect(state(copied).listeners).toEqual([]);
		expect(state(copied).mainThreadEvents).toEqual([]);
		page.engine.dispatch(page.byClass("source"), { type: "tap" });
		await page.settle();
		expect(handles.taps).toBe(1);
		page.engine.dispatch(copied, { type: "tap" });
		await page.settle();
		expect(handles.taps).toBe(1);
		// The source keeps an anchor of its {#if}; the copy holds elements and the text of a <text>.
		expect(kinds(handles["source"]!)).toContain("comment");
		expect(kinds(root)).toEqual(["element", "element", "element"]);
		expect(kinds(root.first!)).toEqual(["text"]);
	});

	it("leaves out id unless keepIds is true", async () => {
		const { page, handles, act, state, children } = await source();
		const [plain, kept] = await act(() => [
			createStaticCopy(handles["source"]!, handles["holder"]!),
			createStaticCopy(handles["source"]!, handles["other"]!, { keepIds: true }),
		]);
		const dropped = children(page.byClass("holder"))[0]!;
		expect(state(dropped).id).toBeNull();
		expect(state(children(dropped)[2]!).id).toBeNull();
		expect(plain!.nodes[0]!.id).toBe("");
		expect(plain!.nodes[0]!.getAttributeNames()).not.toContain("id");
		const same = children(page.byClass("other"))[0]!;
		expect(state(same).id).toBe("source");
		expect(state(children(same)[2]!).id).toBe("inner");
		expect(kept!.nodes[0]!.id).toBe("source");
	});

	it("adds to a container that holds copies, and each remove() takes out its own, once", async () => {
		const { page, handles, act, children, firstClass } = await source();
		const [first, second] = await act(() => [
			createStaticCopy(handles["source"]!, handles["holder"]!),
			createStaticCopy([handles["title"]!, handles["source"]!], handles["holder"]!),
		]);
		const classes = () => children(page.byClass("holder")).map(firstClass);
		expect(classes()).toEqual(["source", "title", "source"]);
		expect(first!.nodes[0]!.parentElement).toBe(handles["holder"]);
		await act(() => first!.remove());
		expect(classes()).toEqual(["title", "source"]);
		expect(first!.nodes[0]!.isConnected).toBe(false);
		expect(second!.nodes[0]!.isConnected).toBe(true);
		await act(() => first!.remove());
		expect(classes()).toEqual(["title", "source"]);
		await act(() => second!.remove());
		expect(classes()).toEqual([]);
		expect(page.engine.invocations).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("refuses a <list> anywhere in the source before it makes a node", async () => {
		const { page, handles, act, children } = await source({ withList: true });
		const made = rs.spyOn(pageRenderer, "createElement");
		try {
			for (const from of [
				handles["source"]!,
				[handles["title"]!, handles["source"]!],
				handles["feed"]!,
			])
				expect(
					thrownBy(() => page.asBackground(() => createStaticCopy(from, handles["holder"]!))),
				).toMatchObject({
					code: "static_copy_list",
					message: expect.stringMatching(/^The source given to createStaticCopy holds a <list>/),
				});
			expect(made).not.toHaveBeenCalled();
		} finally {
			made.mockRestore();
		}
		await page.settle();
		expect(children(page.byClass("holder"))).toEqual([]);
		// A refused call leaves nothing behind: the container still takes a copy.
		await act(() => createStaticCopy(handles["title"]!, handles["holder"]!));
		expect(children(page.byClass("holder"))).toHaveLength(1);
	});

	it("throws one error for a container or a source that is not an element on the page", async () => {
		const { page, handles, act, children } = await source();
		const call = (from: unknown, into: unknown) =>
			thrownBy(() =>
				page.asBackground(() => createStaticCopy(from as ElementNode, into as ElementNode)),
			);
		for (const into of [null, undefined, {}, "holder", 3, page.byClass("holder")])
			expect(call(handles["title"], into)).toMatchObject({
				code: "static_copy_not_on_page",
				message: expect.stringMatching(
					/^The container given to createStaticCopy is not an element on the page/,
				),
			});
		for (const from of [null, undefined, {}, "title", 3, page.byClass("title")])
			expect(call(from, handles["holder"])).toMatchObject({ code: "static_copy_not_on_page" });
		expect(call([handles["title"], {}], handles["holder"])).toMatchObject({
			code: "static_copy_not_on_page",
			message: expect.stringMatching(/^The source\[1\] given to createStaticCopy/),
		});
		expect(call(handles["title"], handles["source"])).toMatchObject({
			code: "static_copy_container_not_empty",
			message: expect.stringMatching(
				/^The <view> given to createStaticCopy as the container holds/,
			),
		});
		const made = await act(() => createStaticCopy(handles["title"]!, handles["other"]!));
		await act(() => made.remove());
		// A copy taken out is no longer on the page.
		expect(call(made.nodes[0], handles["other"])).toMatchObject({
			code: "static_copy_not_on_page",
		});
		// A container Svelte removed is not on the page.
		const removed = handles["holder"];
		await act(() => handles.hideHolder());
		expect(call(handles["title"], removed)).toMatchObject({ code: "static_copy_not_on_page" });
		expect(children(page.byClass("other"))).toEqual([]);
	});

	it("is made of nodes like any other: they answer, take changes and reach Lynx", async () => {
		const { page, handles, act, state, children } = await source();
		page.engine.respondWith((method) =>
			method === "boundingClientRect" ? { code: 0, data: { width: 100, height: 40 } } : { code: 0 },
		);
		const copy = await act(() => createStaticCopy(handles["source"]!, handles["holder"]!));
		const root = copy.nodes[0]!;
		const copied = children(page.byClass("holder"))[0]!;
		expect(root.isConnected).toBe(true);
		expect(handles["holder"]!.contains(root)).toBe(true);
		expect(handles["source"]!.contains(root)).toBe(false);
		expect(root.parentElement).toBe(handles["holder"]);
		expect(root.compareOrder(handles["holder"])).toBeGreaterThan(0);
		const [size] = await act(() => [root.invoke("boundingClientRect")]);
		await expect(size).resolves.toMatchObject({ width: 100, height: 40 });
		expect(page.engine.invocations.at(-1)).toMatchObject({
			element: copied,
			method: "boundingClientRect",
		});
		await act(() => {
			root.setAttribute("data-tone", "set");
			root.setStyleProperty("opacity", "0.5");
		});
		expect(state(copied).dataset["tone"]).toBe("set");
		expect(state(copied).inlineStyles.get("opacity")).toBe("0.5");
		expect(state(page.byClass("source")).dataset["tone"]).toBe("calm");
		expect(state(page.byClass("source")).inlineStyles.has("opacity")).toBe(false);
		const [deep] = await act(() => [root.querySelector(".deep")]);
		await expect(deep).resolves.toBeTruthy();
	});

	it("goes with a container Svelte removes, and remove() then does nothing", async () => {
		const { page, handles, act } = await source();
		const copy: StaticCopy = await act(() =>
			createStaticCopy([handles["source"]!, handles["title"]!], handles["holder"]!),
		);
		const id = copy.nodes[0]!.lynxId;
		expect(pageRenderer.nodeById(id)).toBe(copy.nodes[0]);
		await act(() => handles.hideHolder());
		expect(page.engine.texts().filter((text) => text === "Title")).toHaveLength(1);
		expect(copy.nodes[0]!.isConnected).toBe(false);
		expect(pageRenderer.nodeById(id)).not.toBe(copy.nodes[0]);
		expect(() => page.asBackground(() => copy.remove())).not.toThrow();
		await page.settle();
		expect(page.errors).toEqual([]);
	});
});
