// `self` and `navigator`: WinterTC § 6 and § 7, `userAgent` as an RFC 7231 product and comment from
// what the thread's Lynx says about the device.

import { describe, expect, it } from "@rstest/core";

import type { ThreadLynx } from "../../../src/polyfill/globals.ts";
import { createNavigator, fillNavigator } from "../../../src/polyfill/web/navigator.ts";

const lynx =
	(SystemInfo?: ThreadLynx["SystemInfo"]): (() => ThreadLynx) =>
	() => ({
		reportError: () => {},
		...(SystemInfo && { SystemInfo }),
	});

describe("navigator", () => {
	it("names Lynx's engine version and the platform, from the background's global SystemInfo", () => {
		const scope = { SystemInfo: { platform: "Android", engineVersion: "4.2" } };
		expect(createNavigator(scope, lynx())).toEqual({
			product: "Lynx",
			userAgent: "Lynx/4.2 (Android)",
		});
	});

	it("reads the main thread's lynx.SystemInfo where there is no global one", () => {
		expect(createNavigator({}, lynx({ platform: "iOS", engineVersion: "4.3" })).userAgent).toBe(
			"Lynx/4.3 (iOS)",
		);
	});

	it("leaves out what the device does not say", () => {
		expect(createNavigator({}, lynx()).userAgent).toBe("Lynx");
		expect(createNavigator({ SystemInfo: { platform: "iOS" } }, lynx()).userAgent).toBe(
			"Lynx (iOS)",
		);
	});

	it("is frozen", () => {
		expect(Object.isFrozen(createNavigator({}, lynx()))).toBe(true);
	});
});

describe("the fill", () => {
	it("puts self, the global object itself, and navigator, each made on first read", () => {
		const scope: Record<string, unknown> = {
			SystemInfo: { platform: "iOS", engineVersion: "4.2" },
		};
		fillNavigator(scope, lynx());
		expect(Object.getOwnPropertyDescriptor(scope, "navigator")?.get).toBeTypeOf("function");
		expect(scope["self"]).toBe(scope);
		expect((scope["navigator"] as Navigator).userAgent).toBe("Lynx/4.2 (iOS)");
		expect(Object.keys(scope)).toEqual(["SystemInfo"]);
	});

	it("leaves a thread's own", () => {
		const own = { self: 1, navigator: 2 };
		const scope: Record<string, unknown> = { ...own };
		fillNavigator(scope, lynx());
		expect(scope).toEqual(own);
	});
});
