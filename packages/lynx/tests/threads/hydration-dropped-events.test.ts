// Events on the first frame and the element hydration pairs them with. Hydration pairs Svelte's
// blocks by the branch each took on both threads, so an early event on an element beside a part
// only one thread renders runs its own handler. One on an element hydration made again (another
// branch, a second state only one thread drew) or wrote an attribute over is dropped, not replayed
// through another element's handler, and a development build warns, naming the element. An event
// that reaches no handler there goes on from the first element hydration is sure of; one that
// reaches a dropped handler ends there, whether the page or a listener heard it.

import { describe, expect, it } from "@rstest/core";

import AwaitBeside from "../fixtures/threads/early/AwaitBeside.svelte";
import drawAwaitBeside from "../fixtures/threads/early/AwaitBeside.svelte?first-frame";
import BesideBackgroundOnly from "../fixtures/threads/early/BesideBackgroundOnly.svelte";
import drawBesideBackgroundOnly from "../fixtures/threads/early/BesideBackgroundOnly.svelte?first-frame";
import EachElse from "../fixtures/threads/early/EachElse.svelte";
import drawEachElse from "../fixtures/threads/early/EachElse.svelte?first-frame";
import EmptyLabel from "../fixtures/threads/early/EmptyLabel.svelte";
import drawEmptyLabel from "../fixtures/threads/early/EmptyLabel.svelte?first-frame";
import FlagByProp from "../fixtures/threads/early/FlagByProp.svelte";
import drawFlagByProp from "../fixtures/threads/early/FlagByProp.svelte?first-frame";
import LongPress from "../fixtures/threads/early/LongPress.svelte";
import drawLongPress from "../fixtures/threads/early/LongPress.svelte?first-frame";
import NestedRow from "../fixtures/threads/early/NestedRow.svelte";
import drawNestedRow from "../fixtures/threads/early/NestedRow.svelte?first-frame";
import NoListenerBeside from "../fixtures/threads/early/NoListenerBeside.svelte";
import drawNoListenerBeside from "../fixtures/threads/early/NoListenerBeside.svelte?first-frame";
import Reordered from "../fixtures/threads/early/Reordered.svelte";
import drawReordered from "../fixtures/threads/early/Reordered.svelte?first-frame";
import SameLook from "../fixtures/threads/early/SameLook.svelte";
import drawSameLook from "../fixtures/threads/early/SameLook.svelte?first-frame";
import ScrollBeside from "../fixtures/threads/early/ScrollBeside.svelte";
import drawScrollBeside from "../fixtures/threads/early/ScrollBeside.svelte?first-frame";
import Session from "../fixtures/threads/early/Session.svelte";
import drawSession from "../fixtures/threads/early/Session.svelte?first-frame";
import SessionAvatar from "../fixtures/threads/early/SessionAvatar.svelte";
import drawSessionAvatar from "../fixtures/threads/early/SessionAvatar.svelte?first-frame";
import TextInRun from "../fixtures/threads/early/TextInRun.svelte";
import drawTextInRun from "../fixtures/threads/early/TextInRun.svelte?first-frame";
import TouchBubble from "../fixtures/threads/early/TouchBubble.svelte";
import drawTouchBubble from "../fixtures/threads/early/TouchBubble.svelte?first-frame";
import TouchBubbleSession from "../fixtures/threads/early/TouchBubbleSession.svelte";
import drawTouchBubbleSession from "../fixtures/threads/early/TouchBubbleSession.svelte?first-frame";
import type { FirstFrameCopy, SveltePage } from "./svelte-page.ts";
import { startSveltePage } from "./svelte-page.ts";

/** Starts `App` with a first frame drawn from `drawn` and the background's page from `built`. */
function start(
	App: Parameters<typeof startSveltePage>[0],
	draw: FirstFrameCopy,
	{
		drawn = {},
		built = drawn,
	}: { drawn?: Record<string, unknown>; built?: Record<string, unknown> } = {},
) {
	const log: unknown[] = [];
	const page = startSveltePage(App, {
		props: () => ({ ...built, log }),
		firstFrame: { draw, props: { ...drawn, log } },
	});
	return { page, log };
}

/** Taps the first element with `token` before hydration, then lets hydration happen. */
async function tapEarly(page: SveltePage, token: string): Promise<void> {
	page.engine.dispatch(page.byClass(token), { type: "tap" });
	await page.settle();
}

/** The development warning for dropped events, naming `element`. */
const dropped = (event: string, element: string) =>
	expect.objectContaining({
		code: "first_frame_event_dropped",
		message: expect.stringContaining(`The first frame's ${event} event on ${element} was dropped`),
	});

describe("an early tap beside a part only the background renders", () => {
	it("runs its own handler, and its ancestors'", async () => {
		const { page, log } = start(BesideBackgroundOnly, drawBesideBackgroundOnly);
		await tapEarly(page, "tapped");
		expect(log).toEqual(["tapped", "outer"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("leaves the page's own handlers to run after hydration", async () => {
		const { page, log } = start(BesideBackgroundOnly, drawBesideBackgroundOnly);
		await tapEarly(page, "tapped");
		await tapEarly(page, "tapped");
		await tapEarly(page, "later");
		expect(log).toEqual(["tapped", "outer", "tapped", "outer", "later", "outer"]);
	});

	it("on an element with no handler, goes on from the first element hydration is sure of", async () => {
		const { page, log } = start(NoListenerBeside, drawNoListenerBeside);
		await tapEarly(page, "plain");
		expect(log).toEqual(["outer"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("in a long press, runs its own handler", async () => {
		const { page, log } = start(LongPress, drawLongPress);
		page.engine.dispatch(page.byClass("tapped"), { type: "longpress" });
		await page.settle();
		expect(log).toEqual(["tapped", "outer"]);
		expect(page.warnings).toEqual([]);
	});

	it("behind a component given the background's flag as a prop, runs its own handler", async () => {
		const { page, log } = start(FlagByProp, drawFlagByProp);
		await tapEarly(page, "tapped");
		expect(log).toEqual(["tapped"]);
		expect(page.warnings).toEqual([]);
	});
});

describe("an early event only listeners hear, beside a part only the background renders", () => {
	it("runs its own listener", async () => {
		const { page, log } = start(ScrollBeside, drawScrollBeside);
		page.engine.fire(page.byClass("scroller"), {
			type: "scroll",
			detail: { scrollTop: 4 },
		});
		await page.settle();
		expect(log).toEqual(["scroller"]);
		expect(page.warnings).toEqual([]);
	});

	it("that bubbles, runs its own listener and its ancestors'", async () => {
		const { page, log } = start(TouchBubble, drawTouchBubble);
		page.engine.dispatch(page.byClass("inner"), { type: "touchstart" });
		await page.settle();
		expect(log).toEqual(["inner", "outer"]);
		expect(page.warnings).toEqual([]);
	});
});

describe("an early event that bubbles from an element hydration made again", () => {
	it("ends where a dropped listener heard it, and its ancestors' run no handler", async () => {
		const { page, log } = start(TouchBubbleSession, drawTouchBubbleSession, {
			drawn: {},
			built: { user: "ada" },
		});
		page.engine.dispatch(page.byClass("inner"), { type: "touchstart" });
		await page.settle();
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("touchstart", '<text class="inner">')]);
	});
});

describe("an early tap in a branch picked by data only the background has", () => {
	it("with the same tags, runs neither branch's handler", async () => {
		const { page, log } = start(Session, drawSession, {
			drawn: {},
			built: { user: "ada" },
		});
		await tapEarly(page, "login");
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="login">')]);
	});

	it("with other tags, is warned about", async () => {
		const { page, log } = start(SessionAvatar, drawSessionAvatar, {
			drawn: {},
			built: { user: "ada" },
		});
		await tapEarly(page, "login");
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="login">')]);
	});

	it("is counted, once for its element", async () => {
		const { page, log } = start(Session, drawSession, {
			drawn: {},
			built: { user: "ada" },
		});
		page.engine.dispatch(page.byClass("login"), { type: "tap" });
		page.engine.dispatch(page.byClass("login"), { type: "tap" });
		await page.settle();
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining("was dropped, 2 times:"),
			}),
		]);
	});

	it("where the branches differ only inside a component's own {#if}, runs neither's handler", async () => {
		for (const token of ["row", "label"]) {
			const { page, log } = start(NestedRow, drawNestedRow, {
				drawn: {},
				built: { user: "ada" },
			});
			await tapEarly(page, token);
			expect(log).toEqual([]);
			expect(page.warnings).toEqual([dropped("tap", '<view class="row">')]);
		}
	});

	it("where the branches differ only in the text beside their element, runs neither's handler", async () => {
		const { page, log } = start(TextInRun, drawTextInRun, {
			drawn: {},
			built: { owner: true },
		});
		await tapEarly(page, "go");
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="go">')]);
	});

	it("runs its handler when both threads took the same branch", async () => {
		const { page, log } = start(Session, drawSession, {
			drawn: { user: "ada" },
		});
		await tapEarly(page, "profile");
		expect(log).toEqual(["open profile"]);
		expect(page.warnings).toEqual([]);
	});

	it("in an {#each}'s {:else} the background fills, runs no row's handler", async () => {
		const { page, log } = start(EachElse, drawEachElse, {
			drawn: { items: [] },
			built: { items: ["a"] },
		});
		await tapEarly(page, "empty");
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="empty">')]);
	});

	it("in an {#each}'s {:else} both threads draw, runs its handler", async () => {
		const { page, log } = start(EachElse, drawEachElse, {
			drawn: { items: [] },
		});
		await tapEarly(page, "empty");
		expect(log).toEqual(["add the first"]);
		expect(page.warnings).toEqual([]);
	});

	it("in two branches that look the same, runs neither branch's handler", async () => {
		const { page, log } = start(SameLook, drawSameLook, {
			drawn: {},
			built: { owner: true },
		});
		await tapEarly(page, "cta");
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="cta">')]);
	});
});

describe("an early tap in an {#if} that holds an empty text", () => {
	it.each([
		["an empty badge", { label: "Save", badge: "" }, "save", ["save"]],
		["an empty badge, on the card", { label: "Save", badge: "" }, "card", ["open card"]],
		["an empty label", { label: "", badge: "3" }, "card", ["open card"]],
	])("with %s on both threads, runs its handler", async (_, props, token, ran) => {
		const { page, log } = start(EmptyLabel, drawEmptyLabel, { drawn: props });
		await tapEarly(page, token);
		expect(log).toEqual(ran);
		expect(page.warnings).toEqual([]);
	});
});

// A known hole that pairing blocks by branch does not close: an {#each} with no {:else} is no block
// to hydration, so its rows pair by position. Rows in another order, as many as the first frame's,
// run the handler of the row now at that place.
describe("an early tap on keyed rows the background has in another order", () => {
	it.fails.each([
		["other texts", false],
		["the same texts", true],
	])("with %s, does not run the other row's handler", async (_, same) => {
		const { page, log } = start(Reordered, drawReordered, {
			drawn: { items: ["a", "b", "c"], same },
			built: { items: ["c", "a", "b"], same },
		});
		await tapEarly(page, "row");
		expect(log).not.toEqual(["delete c"]);
	});
});

describe("an early tap beside an {#await} given a promise", () => {
	it("runs its own handler", async () => {
		const { page, log } = start(AwaitBeside, drawAwaitBeside);
		await tapEarly(page, "beside");
		expect(log).toEqual(["beside"]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([]);
	});

	it("on its pending branch, which the background draws again, runs no handler, and is warned about", async () => {
		const { page, log } = start(AwaitBeside, drawAwaitBeside);
		await tapEarly(page, "wait");
		expect(log).toEqual([]);
		expect(page.errors).toEqual([]);
		expect(page.warnings).toEqual([dropped("tap", '<text class="wait">')]);
	});
});
