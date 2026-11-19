// `mountPage` on the main thread: it records how to draw the first frame, with Svelte's server
// renderer, from the page's data and the host's global props. A page whose component awaits
// outside a `pending` boundary has no first frame, and says so once in a development build.

import { afterEach, describe, expect, it } from "@rstest/core";
import type { Component } from "svelte";

import { mountPage } from "../../../src/first-frame/root-entry.ts";
import { installGlobals, readGlobal } from "../../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";

interface ServerRenderer {
	push(html: string): void;
	child(fn: () => Promise<void>): void;
}

/** A server component, as Svelte's server compiler writes one: it pushes its markup. */
const Titled = ((renderer: ServerRenderer, props: { title?: string }) => {
	renderer.push(`<text>${props.title ?? ""}</text>`);
}) as unknown as Component<{ title?: string }>;

/** A server component that awaits as it renders. */
const Awaits = ((renderer: ServerRenderer) => {
	renderer.child(async () => {});
}) as unknown as Component;

/** A server component that throws as it renders. */
const Throws = (() => {
	throw new Error("the component threw");
}) as unknown as Component;

const warnings: unknown[] = [];
let restore = (): void => {};

function draw(initData: Record<string, unknown> = {}): string | null {
	// Boundary: the page's start records a function of the page's data.
	return (readGlobal(FIRST_FRAME_GLOBAL) as (data: Record<string, unknown>) => string | null)(
		initData,
	);
}

function install(globalProps?: Record<string, unknown>): void {
	restore = installGlobals(
		{
			lynx: {
				reportError: (error: unknown) => warnings.push(error),
				...(globalProps && { __globalProps: globalProps }),
			},
		},
		[FIRST_FRAME_GLOBAL],
	);
}

afterEach(() => {
	restore();
	warnings.length = 0;
});

describe("mountPage on the main thread", () => {
	it("records how to draw the first frame, from the page's data", () => {
		install();
		mountPage(Titled, { props: (data) => ({ title: String(data["title"]) }) });
		expect(draw({ title: "Hello" })).toBe("<!--[--><text>Hello</text><!--]-->");
		expect(draw({ title: "Again" })).toBe("<!--[--><text>Again</text><!--]-->");
	});

	it("gives props made from the host's global props too", () => {
		install({ route: "/inbox" });
		mountPage(Titled, {
			props: (data, globals) => ({ title: `${String(data["title"])} ${String(globals["route"])}` }),
		});
		expect(draw({ title: "Hello" })).toBe("<!--[--><text>Hello /inbox</text><!--]-->");
	});

	it("gives props that are an object as they are", () => {
		install();
		mountPage(Titled, { props: { title: "Fixed" } });
		expect(draw({ title: "Hello" })).toBe("<!--[--><text>Fixed</text><!--]-->");
	});

	it("gives a component without props none", () => {
		install();
		mountPage(Titled);
		expect(draw()).toBe("<!--[--><text></text><!--]-->");
	});

	it("draws no frame for a component that awaits, and says so once", () => {
		install();
		mountPage(Awaits);
		expect(draw()).toBeNull();
		expect(draw()).toBeNull();
		expect(warnings).toHaveLength(1);
		expect((warnings[0] as { code?: string }).code).toBe("first_frame_skipped_await");
		expect((warnings[0] as Error).message).toContain("The page Awaits has no first frame");
	});

	it("lets another error through, for the main thread to report", () => {
		install();
		mountPage(Throws);
		expect(() => draw()).toThrow("the component threw");
		expect(warnings).toEqual([]);
	});
});
