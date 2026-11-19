// `mountPage`'s `onError` hears each error the binding reports into Lynx, once, with its thread, its
// component and its code. What Lynx catches itself, a timer's callback or a rejection nobody
// handled, reaches Lynx and not `onError`.

import { describe, expect, it, rs } from "@rstest/core";
import { on } from "svelte/events";

import { crashedSinceStart } from "../../../src/background/errors.ts";
import { host } from "../../../src/background/host-entry.ts";
import { reportError } from "../../../src/background/root-entry.ts";
import type { ErrorContext } from "../../../src/background/root-entry.ts";
import { installGlobals } from "../../../src/testing/globals.ts";
import type { MainThreadLynx } from "../../../src/testing/index.ts";
import { encodeError, encodeToBackground } from "../../../src/wire/index.ts";
import Errors from "../../fixtures/threads/errors/Errors.svelte";
import drawErrors from "../../fixtures/threads/errors/Errors.svelte?first-frame";
import Parent from "../../fixtures/threads/errors/Parent.svelte";
import Fails from "../../fixtures/threads/Fails.svelte";
import ReportsOnMainThread from "../../fixtures/threads/page/ReportsOnMainThread.svelte";
import drawReportsOnMainThread from "../../fixtures/threads/page/ReportsOnMainThread.svelte?first-frame";
import TeardownThrows from "../../fixtures/threads/page/TeardownThrows.svelte";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";
import { lynxTimer, tapAndWait } from "./lynx-timer.ts";

/** What `onError` heard, in order. */
type Heard = [Error, ErrorContext][];

/**
 * The page of `Errors.svelte`, with an `onError` that keeps what it hears, and Lynx's background
 * timer for the component's `later`.
 */
async function errorsPage(): Promise<{
	page: SveltePage;
	heard: Heard;
	tap(name: string): Promise<void>;
}> {
	// The first-frame copy registers the main-thread function; no frame is drawn.
	void drawErrors;
	const heard: Heard = [];
	const made: { page?: SveltePage } = {};
	const page = startSveltePage(Errors, {
		props: { later: lynxTimer(() => made.page!) },
		onError: (error, context) => void heard.push([error, context]),
	});
	made.page = page;
	await page.settle();
	return { page, heard, tap: (name) => tapAndWait(page, name) };
}

/** The main thread's reports into Lynx, with their codes, where the engine has `_ReportError`. */
function withCodes(page: SveltePage): unknown[][] {
	const reports: unknown[][] = [];
	page.asMainThread(() =>
		installGlobals({
			_ReportError: (error: Error, options: unknown) =>
				void reports.push([error.message.split("\n")[0], options]),
		}),
	);
	return reports;
}

const messages = (values: unknown[]): string[] =>
	values.map((value) => (value instanceof Error ? value.message : String(value)).split("\n")[0]!);

describe("onError on the background", () => {
	it("hears a handler's throw once, after Lynx, with the handler's component", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("handler");
		expect(messages(page.errors)).toEqual(["the handler threw"]);
		expect(heard).toEqual([
			[page.errors[0], { thread: "background", component: "Errors.svelte", code: undefined }],
		]);
	});

	it("hears what the app reports with reportError, as an Error", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("report");
		expect(page.errors).toEqual(["the app reported it"]);
		expect(heard).toHaveLength(1);
		expect(heard[0]![0]).toEqual(new Error("the app reported it"));
		expect(heard[0]![1]).toEqual({ thread: "background", component: undefined, code: undefined });
	});

	it("hears an effect a timer's change ran: one report, one call, the effect's component", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("effect");
		expect(messages(page.errors)).toEqual(["the effect threw"]);
		expect(heard).toHaveLength(1);
		expect(heard[0]![0]).toBe(page.errors[0]);
		expect(heard[0]![1]).toEqual({
			thread: "background",
			component: "Errors.svelte",
			code: undefined,
		});
	});

	it("names the innermost component of an effect's error, from Svelte's development lines", async () => {
		const heard: Heard = [];
		const page = startSveltePage(Parent, {
			onError: (error, context) => void heard.push([error, context]),
		});
		await page.settle();
		page.engine.dispatch(page.byClass("more"), { type: "tap" });
		await page.settle();
		expect(messages(page.errors)).toEqual(["the child's effect threw"]);
		expect(heard.map(([, context]) => context.component)).toEqual(["Child.svelte"]);
	});

	it("hears a component that throws as the page starts", async () => {
		const heard: Heard = [];
		const page = startSveltePage(Fails, {
			onError: (error, context) => void heard.push([error, context]),
		});
		await page.settle();
		expect(heard.map(([error]) => error)).toEqual(page.errors);
		expect(heard).toHaveLength(1);
	});

	it("hears a background function a main-thread function called, once", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("call");
		expect(messages(page.errors)).toEqual(["the background function threw"]);
		expect(heard.map(([error, context]) => [error.message, context.thread])).toEqual([
			["the background function threw", "background"],
		]);
	});

	it("hears a host listener that throws, once, and the other listeners still run", async () => {
		const heard: Heard = [];
		const page = startSveltePage(Parent, {
			onError: (error, context) => void heard.push([error, context]),
		});
		await page.settle();
		const ran: string[] = [];
		page.asBackground(() => {
			on(host, "onWindowResize", () => {
				throw new Error("the listener threw");
			});
			on(host, "onWindowResize", () => void ran.push("after"));
		});
		page.emitHostEvent("onWindowResize", [390, 844]);
		await page.settle();
		expect(ran).toEqual(["after"]);
		expect(messages(page.errors)).toEqual(["the listener threw"]);
		expect(heard.map(([error, context]) => [error.message, context.thread])).toEqual([
			["the listener threw", "background"],
		]);
	});

	it("leaves the global timer an app calls as it is: its throw reaches the host, not onError", async () => {
		// The binding replaces no timer (the background's fills put none on the global object): an
		// app's `setTimeout` is the thread's own, which on a device is lynx-core's and reports what
		// it throws. Here it is the process's, so the process hears the throw, in place of the test
		// runner, which would fail the file for it.
		const thrown: unknown[] = [];
		const onThrown = (error: unknown) => void thrown.push(error);
		const runners = process.listeners("uncaughtException");
		process.removeAllListeners("uncaughtException");
		process.on("uncaughtException", onThrown);
		try {
			const { page, heard, tap } = await errorsPage();
			await tap("global-timer");
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(page.errors).toEqual([]);
			expect(heard).toEqual([]);
		} finally {
			process.off("uncaughtException", onThrown);
			for (const runner of runners) process.on("uncaughtException", runner);
		}
		expect(messages(thrown)).toEqual(["the global timer threw"]);
	});

	it("does not hear a rejection nobody handled, which Lynx reports itself", async () => {
		// Lynx reports a rejection the page left unhandled; here the process hears it, in place of
		// the test runner, which would fail the file for it.
		const rejected: unknown[] = [];
		const onRejected = (reason: unknown) => void rejected.push(reason);
		const runners = process.listeners("unhandledRejection");
		process.removeAllListeners("unhandledRejection");
		process.on("unhandledRejection", onRejected);
		try {
			const { page, heard, tap } = await errorsPage();
			await tap("rejection");
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(page.errors).toEqual([]);
			expect(heard).toEqual([]);
		} finally {
			process.off("unhandledRejection", onRejected);
			for (const runner of runners) process.on("unhandledRejection", runner);
		}
		expect(messages(rejected)).toEqual(["nobody handled it"]);
	});

	it("hears every repeat, while Lynx gets the 1st and the 10th, with the count", async () => {
		const { page, heard, tap } = await errorsPage();
		for (let time = 0; time < 12; time++) await tap("handler");
		expect(messages(page.errors)).toEqual(["the handler threw", "the handler threw (×10)"]);
		expect(heard).toHaveLength(12);
		// `onError` gets the error as it was thrown; Lynx's report says how many.
		expect(new Set(heard.map(([error]) => error.message))).toEqual(new Set(["the handler threw"]));
	});
});

describe("onError and the main thread", () => {
	it("hears a main-thread function's throw once, reported with the main thread's code, as the engine reports it", async () => {
		const { page, heard, tap } = await errorsPage();
		const reports = withCodes(page);
		await tap("main-thread");
		expect(reports).toEqual([["the main-thread function threw", { errorCode: 110100 }]]);
		expect(heard).toHaveLength(1);
		expect(heard[0]![0].message).toBe("the main-thread function threw");
		expect(heard[0]![1]).toEqual({
			thread: "main-thread",
			component: "Errors.svelte",
			code: undefined,
		});
	});

	it("lets the engine's tap go on: a throwing main-thread function answers nothing", async () => {
		const { page, tap } = await errorsPage();
		withCodes(page);
		await tap("main-thread");
		await tap("main-thread");
		expect(page.engine.texts()).toEqual([""]);
	});

	it("hears reportError from a main-thread function, reported with the main thread's code", async () => {
		void drawReportsOnMainThread;
		const heard: Heard = [];
		const page = startSveltePage(ReportsOnMainThread, {
			onError: (error, context) => void heard.push([error, context]),
		});
		await page.settle();
		const reports = withCodes(page);
		page.engine.dispatch(page.byClass("report"), { type: "tap" });
		await page.settle();
		expect(reports).toEqual([["reported on the main thread", { errorCode: 110100 }]]);
		expect(heard.map(([error, context]) => [error.message, context])).toEqual([
			[
				"reported on the main thread",
				{ thread: "main-thread", component: undefined, code: undefined },
			],
		]);
	});

	it("hears the binding's own main-thread errors with their code", async () => {
		const heard: Heard = [];
		const page = startSveltePage(Fails, {
			onError: (error, context) => void heard.push([error, context]),
			firstFrame: () => {
				throw new Error("the first frame threw");
			},
		});
		const reports = withCodes(page);
		await page.settle();
		expect(reports).toEqual([]);
		const fromMainThread = heard.filter(([, context]) => context.thread === "main-thread");
		expect(fromMainThread.map(([, context]) => context.code)).toEqual(["first_frame_threw"]);
	});

	it("does not hear an error of a page that is gone", async () => {
		const { page, heard } = await errorsPage();
		const send = (stamp: number) =>
			page.asMainThread(() =>
				(page.lynx.mainThread as MainThreadLynx)
					.getJSContext()
					.dispatchEvent(
						encodeToBackground({ t: "error", error: encodeError(new Error("old page")) }, stamp),
					),
			);
		page.reload();
		await page.settle();
		send(0);
		await page.settle();
		expect(heard).toEqual([]);
		page.destroy();
		await page.settle();
		send(1);
		await page.settle();
		expect(heard).toEqual([]);
	});
});

describe("what onError throws", () => {
	it("is reported into Lynx once, and never logged", async () => {
		const logged = rs.spyOn(console, "error").mockImplementation(() => {});
		try {
			const heard: string[] = [];
			const page = startSveltePage(Errors, {
				props: { later: () => {} },
				onError: (error) => {
					heard.push(error.message);
					throw new Error("onError threw");
				},
			});
			await page.settle();
			page.engine.dispatch(page.byClass("handler"), { type: "tap" });
			await page.settle();
			expect(messages(page.errors)).toEqual(["the handler threw", "onError threw"]);
			expect(heard).toEqual(["the handler threw"]);
			expect(logged).not.toHaveBeenCalled();
		} finally {
			logged.mockRestore();
		}
	});

	it("does not call onError again for what onError reports", async () => {
		const heard: string[] = [];
		const page = startSveltePage(Errors, {
			props: { later: () => {} },
			onError: (error) => {
				heard.push(error.message);
				reportError(new Error(`heard: ${error.message}`));
			},
		});
		await page.settle();
		page.engine.dispatch(page.byClass("handler"), { type: "tap" });
		await page.settle();
		expect(messages(page.errors)).toEqual(["the handler threw", "heard: the handler threw"]);
		expect(heard).toEqual(["the handler threw"]);
	});
});

describe("a thrown value that is not an Error", () => {
	it("is written as Lynx writes it, and different values count apart", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("object-404");
		await tap("object-500");
		await tap("report-503");
		expect(page.errors).toEqual([
			{ status: 404 },
			{ status: 500, reason: "the server failed" },
			{ status: 503 },
		]);
		expect(heard.map(([error]) => error.message)).toEqual([
			'{"status":404}',
			'{"status":500,"reason":"the server failed"}',
			'{"status":503}',
		]);
	});

	it("thrown by a main-thread function, reaches onError with its value as its text", async () => {
		const { page, heard, tap } = await errorsPage();
		const reports = withCodes(page);
		await tap("main-thread-object");
		expect(reports).toEqual([['{"status":418}', { errorCode: 110100 }]]);
		expect(heard.map(([error, context]) => [error.message, context.thread])).toEqual([
			['{"status":418}', "main-thread"],
		]);
	});
});

describe("onError's code", () => {
	it("is undefined for an app's own error that has a code of its own", async () => {
		const { heard, tap } = await errorsPage();
		await tap("coded");
		expect(heard.map(([error, context]) => [error.message, context.code])).toEqual([
			["reset", undefined],
		]);
	});
});

describe("reporting", () => {
	it("never throws over the error it reports, even one whose stack is not text", async () => {
		const { page, heard, tap } = await errorsPage();
		await tap("odd-stack");
		await tap("odd-stack");
		expect(messages(page.errors)).toEqual(["odd stack"]);
		expect(heard.map(([error]) => error.message)).toEqual(["odd stack", "odd stack"]);
	});

	it("counts a page's repeats from none again at a reload, on the background", async () => {
		const { page, tap } = await errorsPage();
		await tap("handler");
		page.reload();
		await page.settle();
		await tap("handler");
		expect(messages(page.errors)).toEqual(["the handler threw", "the handler threw"]);
	});

	it("counts the main thread's repeats, and from none again at a reload", async () => {
		const { page, heard, tap } = await errorsPage();
		const reports = withCodes(page);
		for (let time = 0; time < 10; time++) await tap("main-thread");
		expect(reports.map(([message]) => message)).toEqual([
			"the main-thread function threw",
			"the main-thread function threw (×10)",
		]);
		expect(heard).toHaveLength(10);
		page.reload();
		await page.settle();
		await tap("main-thread");
		expect(reports.map(([message]) => message).at(-1)).toBe("the main-thread function threw");
	});
});

describe("a page's crash, for the reload after a save", () => {
	it("is marked by a reported error, and cleared by a reload", async () => {
		const { page, tap } = await errorsPage();
		expect(crashedSinceStart()).toBe(false);
		await tap("handler");
		expect(crashedSinceStart()).toBe(true);
		page.reload();
		await page.settle();
		expect(crashedSinceStart()).toBe(false);
	});
});

describe("onError at the page's end", () => {
	it("hears what the page's last teardown threw", async () => {
		const heard: string[] = [];
		const page = startSveltePage(TeardownThrows, {
			onError: (error) => void heard.push(error.message.split("\n")[0]!),
		});
		await page.settle();
		page.destroy();
		await page.settle();
		expect(messages(page.errors)).toEqual(["teardown failed"]);
		expect(heard).toEqual(["teardown failed"]);
	});

	it("hears nothing more once the page has ended", async () => {
		const { page, heard } = await errorsPage();
		page.destroy();
		await page.settle();
		page.asBackground(() => reportError(new Error("after the end")));
		expect(messages(page.errors)).toEqual(["after the end"]);
		expect(heard).toEqual([]);
	});
});
