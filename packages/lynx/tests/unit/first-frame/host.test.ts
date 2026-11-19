// `@sohedra/lynx/host` on the main thread: each value is what the first frame is drawn with, and
// the host's events, which reach the background only, throw there and ask the engine for nothing.

import { afterEach, describe, expect, it, rs } from "@rstest/core";
import type { Component } from "svelte";

import {
	globalProps,
	host,
	initData,
	keyboard,
	systemInfo,
} from "../../../src/first-frame/host-entry.ts";
import { mountPage } from "../../../src/first-frame/root-entry.ts";
import { installGlobals, readGlobal } from "../../../src/testing/globals.ts";
import { FIRST_FRAME_GLOBAL } from "../../../src/wire/index.ts";

interface ServerRenderer {
	push(html: string): void;
}

let restore = (): void => {};
afterEach(() => restore());

function install(lynx: Record<string, unknown>): void {
	restore = installGlobals({ lynx: { reportError: () => {}, ...lynx } }, [FIRST_FRAME_GLOBAL]);
}

describe("the host's values on the main thread", () => {
	it("give the data the first frame is drawn from, as the components draw it", () => {
		install({});
		const seen: unknown[] = [];
		const Reads = ((renderer: ServerRenderer) => {
			seen.push(initData.current);
			renderer.push("<view></view>");
		}) as unknown as Component;
		mountPage(Reads);
		const data = { title: "Inbox" };
		// Boundary: the page's start records a function of the page's data.
		(readGlobal(FIRST_FRAME_GLOBAL) as (data: Record<string, unknown>) => string | null)(data);
		expect(seen).toEqual([data]);
		expect(initData.current).toBe(data);
	});

	it("give the global props and what Lynx says about the device, as the main thread has them", () => {
		const info = { platform: "Android" };
		install({ __globalProps: { theme: "dark" }, SystemInfo: info });
		expect(globalProps.current).toEqual({ theme: "dark" });
		expect(systemInfo.current).toBe(info);
		install({});
		expect(globalProps.current).toEqual({});
		expect(systemInfo.current).toEqual({});
	});

	it("give the keyboard as closed", () => {
		expect(keyboard.current).toEqual({ open: false, height: 0 });
	});
});

describe("the host's events on the main thread", () => {
	it("throw for a listener, and ask the engine for nothing", () => {
		const getJSModule = rs.fn();
		install({ getJSModule });
		const listener = rs.fn();
		expect(() => host.addEventListener("keyboardstatuschanged", listener)).toThrow(
			expect.objectContaining({ code: "called_on_main_thread" }),
		);
		expect(() => host.removeEventListener("keyboardstatuschanged", listener)).toThrow(
			/^A call of on\(host, …\) ran on the main thread/,
		);
		expect(getJSModule).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
	});
});
