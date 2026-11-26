// The web platform: core's Platform contract on the DOM.
import { afterEach, describe, expect, it, vi } from "vitest";

import { webPlatform, webScheduler } from "#lib/foundation/kernel/index.js";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

describe("webScheduler", () => {
	it("runs timeouts on the (fake) global timers, read at call time", () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		webScheduler.timeout(callback, 100);
		vi.advanceTimersByTime(99);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledOnce();

		const canceled = vi.fn();
		webScheduler.timeout(canceled, 10)();
		vi.advanceTimersByTime(10);
		expect(canceled).not.toHaveBeenCalled();
	});

	it("falls back to a 16ms timeout for frames without requestAnimationFrame", () => {
		vi.stubGlobal("requestAnimationFrame", undefined);
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const callback = vi.fn();
		webScheduler.frame(callback);
		vi.advanceTimersByTime(15);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledOnce();

		const canceled = vi.fn();
		webScheduler.frame(canceled)();
		vi.advanceTimersByTime(16);
		expect(canceled).not.toHaveBeenCalled();
	});

	// What the callbacks change (two popups unmounting) lands before
	// a microtask any of them queues.
	it("runs the frame callbacks requested before a frame in one requestAnimationFrame", async () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
			frames.push(callback),
		);
		const calls: string[] = [];
		webScheduler.frame(() => {
			calls.push("first");
			queueMicrotask(() => calls.push("first's microtask"));
		});
		webScheduler.frame(() => calls.push("canceled"))();
		webScheduler.frame(() => {
			calls.push("second");
			webScheduler.frame(() => calls.push("next frame"));
		});
		expect(frames).toHaveLength(1);

		frames.shift()!(0);
		await Promise.resolve();
		expect(calls).toEqual(["first", "second", "first's microtask"]);
		expect(frames).toHaveLength(1);
		frames.shift()!(0);
		expect(calls.at(-1)).toBe("next frame");
	});

	it("runs microtasks after the current work, unless canceled", async () => {
		const calls: string[] = [];
		webScheduler.microtask(() => calls.push("microtask"));
		webScheduler.microtask(() => calls.push("canceled"))();
		calls.push("sync");
		await Promise.resolve();
		expect(calls).toEqual(["sync", "microtask"]);
	});

	it("reads the clock of event timestamps", () => {
		const first = webScheduler.now();
		expect(webScheduler.now()).toBeGreaterThanOrEqual(first);
		const event = new Event("x");
		expect(Math.abs(event.timeStamp - webScheduler.now())).toBeLessThan(1000);
	});
});

describe("webPlatform", () => {
	function elements(html: string) {
		document.body.innerHTML = html;
		return Array.from(document.body.querySelectorAll("[data-x]"));
	}

	it("orders elements by document position, detached ones last", () => {
		const [a, b] = elements("<div data-x><span data-x></span></div>");
		const detached = document.createElement("div");
		const { compare } = webPlatform.order;
		expect(compare(a, b)).toBeLessThan(0);
		expect(compare(b, a)).toBeGreaterThan(0);
		expect(compare(a, a)).toBe(0);
		expect(compare(a, detached)).toBeLessThan(0);
		expect(compare(detached, a)).toBeGreaterThan(0);
		expect(compare(detached, document.createElement("p"))).toBe(0);
	});

	it("leaves elements in separate shadow trees unordered", () => {
		const [host] = elements("<div data-x></div>");
		const shadow = host.attachShadow({ mode: "open" });
		const inner = shadow.appendChild(document.createElement("button"));
		const outer = document.body.appendChild(document.createElement("button"));
		expect(webPlatform.order.compare(inner, outer)).toBe(0);
	});

	it("focuses, and selects a text field's text when asked", () => {
		const [input, button] = elements('<input data-x value="hello"><button data-x></button>');
		webPlatform.focus.focus(button);
		expect(document.activeElement).toBe(button);
		webPlatform.focus.focus(input, { select: true });
		expect(document.activeElement).toBe(input);
		expect((input as HTMLInputElement).selectionStart).toBe(0);
		expect((input as HTMLInputElement).selectionEnd).toBe(5);
		webPlatform.focus.focus(button, { preventScroll: true });
		expect(document.activeElement).toBe(button);
	});

	it("submits a control's form", () => {
		const [input] = elements('<form><input data-x name="a"></form>');
		const form = input.closest("form")!;
		const onSubmit = vi.fn((event: Event) => event.preventDefault());
		form.addEventListener("submit", onSubmit);
		webPlatform.form.requestSubmit(input);
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it("submits a form-associated control's own form, never the enclosing one it isn't in", () => {
		const [external, input, orphan, div] = elements(
			'<form data-x id="external"></form><form><input data-x form="external"><input data-x form="not-a-form"><div data-x></div></form><div id="not-a-form"></div>',
		);
		const [, enclosing] = Array.from(document.querySelectorAll("form"));
		const onExternal = vi.fn((event: Event) => event.preventDefault());
		const onEnclosing = vi.fn((event: Event) => event.preventDefault());
		external.addEventListener("submit", onExternal);
		enclosing.addEventListener("submit", onEnclosing);
		webPlatform.form.requestSubmit(input);
		expect(onExternal).toHaveBeenCalledOnce();
		expect(onEnclosing).not.toHaveBeenCalled();
		// The `form` attribute names something that isn't a form: no form.
		webPlatform.form.requestSubmit(orphan);
		expect(onEnclosing).not.toHaveBeenCalled();
		// An element that isn't form-associated submits the enclosing form.
		webPlatform.form.requestSubmit(div);
		expect(onEnclosing).toHaveBeenCalledOnce();
	});

	it("doesn't submit a form without requestSubmit", () => {
		const [input] = elements('<form><input data-x name="a"></form>');
		const form = input.closest("form")!;
		Object.defineProperty(form, "requestSubmit", { configurable: true, value: undefined });
		expect(() => webPlatform.form.requestSubmit(input)).not.toThrow();
	});

	it("formats numbers and compares text with Intl, one instance per locale and options", () => {
		const formatter = webPlatform.locale.numberFormat("en-US", { maximumFractionDigits: 1 });
		expect(formatter.format(1234.56)).toBe("1,234.6");
		expect(formatter.formatToParts(1.5).map((part) => part.type)).toEqual([
			"integer",
			"decimal",
			"fraction",
		]);
		expect(webPlatform.locale.numberFormat("en-US", { maximumFractionDigits: 1 })).toBe(formatter);
		const collator = webPlatform.locale.collator("en", { sensitivity: "base" });
		expect(collator.compare("a", "A")).toBe(0);
		expect(collator.compare("a", "b")).toBeLessThan(0);
	});

	it("keeps a formatter and a collator per Intl.Locale tag", () => {
		const german = webPlatform.locale.numberFormat(new Intl.Locale("de-DE"));
		const english = webPlatform.locale.numberFormat(new Intl.Locale("en-US"));
		expect(german.format(1234.5)).toBe("1.234,5");
		expect(english.format(1234.5)).toBe("1,234.5");
		expect(webPlatform.locale.numberFormat("de-DE")).toBe(german);
		expect(webPlatform.locale.numberFormat([new Intl.Locale("en-US")])).toBe(english);
		const swedish = webPlatform.locale.collator(new Intl.Locale("sv"));
		const english2 = webPlatform.locale.collator(new Intl.Locale("en"));
		expect(swedish).not.toBe(english2);
	});
});
