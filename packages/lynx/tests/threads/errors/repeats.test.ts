// In a development build, an error that repeats is folded into its count in Lynx until it has been
// quiet for five seconds, on either thread: a retry after that is a new LogBox entry. `onError`
// hears every one.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import type { ErrorContext } from "../../../src/background/root-entry.ts";
import Errors from "../../fixtures/threads/errors/Errors.svelte";
import drawErrors from "../../fixtures/threads/errors/Errors.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";
import { lynxTimer, tapAndWait } from "./lynx-timer.ts";

afterEach(() => {
	rs.restoreAllMocks();
});

/** Both threads' clock, moved by the test: `Date.now`, in milliseconds. */
function clock(): { pass(milliseconds: number): void } {
	let now = 1_000_000;
	rs.spyOn(Date, "now").mockImplementation(() => now);
	return {
		pass(milliseconds) {
			now += milliseconds;
		},
	};
}

/** The page of `Errors.svelte`, with what `onError` heard. */
async function errorsPage(): Promise<{
	page: SveltePage;
	heard: [Error, ErrorContext][];
	tap(name: string): Promise<void>;
}> {
	// The first-frame copy registers the main-thread function; no frame is drawn.
	void drawErrors;
	const heard: [Error, ErrorContext][] = [];
	const made: { page?: SveltePage } = {};
	const page = startSveltePage(Errors, {
		props: { later: lynxTimer(() => made.page!) },
		onError: (error, context) => void heard.push([error, context]),
	});
	made.page = page;
	await page.settle();
	return { page, heard, tap: (name) => tapAndWait(page, name) };
}

const firstLines = (values: unknown[]): string[] =>
	values.map((value) => (value instanceof Error ? value.message : String(value)).split("\n")[0]!);

describe("a repeat on the background", () => {
	it("is folded within five seconds of the last, and a new LogBox entry after", async () => {
		const time = clock();
		const { page, heard, tap } = await errorsPage();
		await tap("handler");
		time.pass(4999);
		await tap("handler");
		expect(firstLines(page.errors)).toEqual(["the handler threw"]);
		time.pass(5000);
		await tap("handler");
		expect(firstLines(page.errors)).toEqual(["the handler threw", "the handler threw"]);
		expect(heard.map(([, context]) => context.thread)).toEqual([
			"background",
			"background",
			"background",
		]);
	});
});

describe("a repeat on the main thread", () => {
	it("is folded within five seconds of the last, and a new LogBox entry after", async () => {
		const time = clock();
		const { page, heard, tap } = await errorsPage();
		await tap("main-thread");
		time.pass(4999);
		await tap("main-thread");
		expect(firstLines(page.errors)).toEqual(["the main-thread function threw"]);
		time.pass(5000);
		await tap("main-thread");
		expect(firstLines(page.errors)).toEqual([
			"the main-thread function threw",
			"the main-thread function threw",
		]);
		expect(heard.map(([, context]) => context.thread)).toEqual([
			"main-thread",
			"main-thread",
			"main-thread",
		]);
	});
});
