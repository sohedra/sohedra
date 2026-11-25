// A root component that throws on the background as it mounts, under a first frame: in its script,
// in its template, or in a child outside any boundary. The background has no page to send, so it
// sends a patch that says the page did not start. The main thread keeps the first frame on the
// screen, stops logging its taps, and rejects the calls it held; the app's author sees one coded
// error. Data and global props that come later are not drawn over the frame, and hydrate nothing.
// An effect's throw comes after the page rendered, and the frame is hydrated as usual. A reload
// that throws sends its patch as before.

import { describe, expect, it } from "@rstest/core";

import StartThrows from "../../fixtures/threads/errors/StartThrows.svelte";
import drawStartThrows from "../../fixtures/threads/errors/StartThrows.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

type Throws = "script" | "template" | "child" | "effect" | "global" | "none";

function starting(throws: Throws) {
	const log: unknown[] = [];
	const props: { log: unknown[]; throws: Throws } = { log, throws };
	const page = startSveltePage(StartThrows, {
		props: () => props,
		firstFrame: { draw: drawStartThrows, props },
	});
	return { page, log, props };
}

const codes = (page: SveltePage): unknown[] =>
	page.errors.map(
		(error) => (error as { code?: unknown }).code ?? (error as Error).message.split("\n")[0],
	);

const DRAWN = ["tap", "call", "child"];

const isUnref = (item: readonly unknown[]): boolean =>
	item[0] === "call" && typeof item[3] === "string" && item[3].startsWith('["unref"');

describe.each(["script", "template", "child"] as const)(
	"a root that throws in its %s at start",
	(throws) => {
		it("keeps the first frame, and reports one coded error with the throw as its cause", async () => {
			const { page } = starting(throws);
			const drawn = page.engine.all();
			await page.settle();
			// Only the collector's `unref` of a ref let go of earlier may ride along: it runs when it
			// likes, and ref ids are never reused.
			expect(page.patches).toEqual([expect.objectContaining({ notStarted: true })]);
			expect(page.patches[0]!.items.filter((item) => !isUnref(item))).toEqual([]);
			expect(page.engine.all()).toEqual(drawn);
			expect(page.engine.texts()).toEqual(DRAWN);
			expect(codes(page)).toEqual(["page_not_started"]);
			const [error] = page.errors as (Error & { cause?: unknown })[];
			expect(error!.message).toContain(`the ${throws} threw at start`);
			expect((error!.cause as Error).message).toMatch(new RegExp(`^the ${throws} threw at start`));
			// The app's own frames, where it threw: LogBox shows this error, not its cause.
			expect(error!.stack).toMatch(/^Error: The page did not start/);
			expect(error!.stack).toContain(
				throws === "child" ? "StartThrowsChild.svelte" : "StartThrows.svelte",
			);
			expect(error!.stack).not.toContain("reportNotStarted");
		});

		it("stops logging taps, rejects the calls it held with a code, and runs no main-thread function after", async () => {
			const { page, log } = starting(throws);
			page.engine.dispatch(page.byClass("tap"), { type: "tap" });
			page.engine.dispatch(page.byClass("call"), { type: "tap" });
			await page.settle();
			expect(page.engine.state(page.byClass("call")).attrs["refused"]).toBe("page_not_started");
			expect(page.engine.state(page.byClass("call")).attrs["runs"]).toBe(1);
			page.engine.dispatch(page.byClass("call"), { type: "tap" });
			for (let tap = 0; tap < 5; tap++) page.engine.dispatch(page.byClass("tap"), { type: "tap" });
			await page.settle();
			expect(page.runtime.page.frame).toBeUndefined();
			expect(page.messages.filter((message) => message.t !== "error")).toEqual([]);
			expect(log).toEqual([]);
			expect(page.engine.state(page.byClass("call")).attrs["answered"]).toBeUndefined();
			expect(page.engine.state(page.byClass("call")).attrs["runs"]).toBe(1);
			expect(codes(page)).toEqual(["page_not_started"]);
		});

		it("draws nothing over the frame when data or global props come later, and refuses nothing", async () => {
			const { page } = starting(throws);
			await page.settle();
			const drawn = page.engine.all();
			page.updateData({ more: 1 });
			await page.settle();
			page.updateGlobalProps({ theme: "dark" });
			await page.settle();
			expect(page.engine.all()).toEqual(drawn);
			expect(page.engine.texts()).toEqual(DRAWN);
			expect(page.messages.filter((message) => message.t === "rewrite")).toEqual([]);
			expect(codes(page)).toEqual(["page_not_started"]);
		});

		it("starts over at a reload, whose throw is reported and sent as before", async () => {
			const { page } = starting(throws);
			await page.settle();
			page.reload();
			await page.settle();
			const last = page.patches.at(-1)!;
			expect(last.generation).toBe(1);
			expect(last.notStarted).toBeUndefined();
			expect(page.engine.texts()).toEqual([]);
			expect(codes(page)).toEqual(["page_not_started", `the ${throws} threw at start`]);
		});
	},
);

describe("a reload after a root that threw at start", () => {
	it("mounts the page, which answers taps, with no error after the start's", async () => {
		const { page, log, props } = starting("script");
		await page.settle();
		props.throws = "none";
		page.reload();
		await page.settle();
		expect(page.engine.texts()).toEqual(DRAWN);
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["tap"]);
		expect(codes(page)).toEqual(["page_not_started"]);
	});
});

describe("a root that reads a global Lynx lacks at start", () => {
	it("names the import that fills it, in the error that says the page did not start", async () => {
		const { page } = starting("global");
		await page.settle();
		expect(codes(page)).toEqual(["page_not_started"]);
		const [error] = page.errors as (Error & { cause?: Error & { code?: string } })[];
		expect(error!.message.split("\n")[0]).toContain(
			"(The global `URL` is not defined: Lynx's engine doesn't have it, and no import put it there.)",
		);
		expect(error!.cause!.code).toBe("global_not_filled");
	});
});

describe("a props function that throws at start", () => {
	it("is reported as the page not started, with its throw as the reason, and the frame kept", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(StartThrows, {
			props: () => {
				throw new Error("the props threw at start");
			},
			firstFrame: { draw: drawStartThrows, props: { log, throws: "none" } },
		});
		await page.settle();
		expect(page.engine.texts()).toEqual(DRAWN);
		expect(codes(page)).toEqual(["page_not_started"]);
		const [error] = page.errors as Error[];
		expect(error!.message.split("\n")[0]).toBe(
			"The page did not start: the background threw as it mounted the root component (the props threw at start), so its first frame stays and answers nothing.",
		);
	});
});

describe("a root that throws at start with no first frame", () => {
	it("leaves the page empty, and draws nothing when data comes later", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(StartThrows, { props: () => ({ log, throws: "script" }) });
		await page.settle();
		page.updateData({ more: 1 });
		await page.settle();
		expect(page.patches[0]!.notStarted).toBe(true);
		expect(page.engine.texts()).toEqual([]);
		expect(codes(page)).toEqual(["page_not_started"]);
	});
});

describe("an effect that throws at start", () => {
	it("comes after the page rendered: the first frame is hydrated, and the throw reported as it is", async () => {
		const { page, log } = starting("effect");
		const drawn = page.byClass("tap");
		await page.settle();
		expect(page.patches[0]!.notStarted).toBeUndefined();
		expect(page.patches[0]!.rendered).toBeGreaterThan(0);
		expect(page.byClass("tap")).toBe(drawn);
		expect(codes(page)).toEqual(["the effect threw at start"]);
		page.engine.dispatch(page.byClass("tap"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["tap"]);
	});
});
