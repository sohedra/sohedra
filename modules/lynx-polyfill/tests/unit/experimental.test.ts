// An experimental fill warns once, in a development build, the first time an app uses it.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { stopHearing } from "./reports.ts";

afterEach(() => {
	stopHearing();
	rs.unstubAllEnvs();
	rs.resetModules();
});

/** A `lynx` whose `reportError` keeps each report with its options. */
function hearWarnings(): { error: Error; options: unknown }[] {
	const heard: { error: Error; options: unknown }[] = [];
	// Boundary: the fills read the thread's `lynx` by name, a global in this process.
	(globalThis as unknown as { lynx?: unknown }).lynx = {
		reportError: (error: Error, options: unknown) => void heard.push({ error, options }),
	};
	return heard;
}

describe("an experimental fill", () => {
	it("warns into Lynx the first time one of its globals is read, once for the import", async () => {
		const { fillMessaging } = await import("../../src/fills/web/messaging.ts");
		const { fillEvents } = await import("../../src/fills/web/events.ts");
		const heard = hearWarnings();
		const scope: Record<string, unknown> = {};
		fillEvents(scope);
		fillMessaging(scope);
		expect(heard).toEqual([]);
		void scope["MessageChannel"];
		void scope["MessagePort"];
		expect(heard).toHaveLength(1);
		expect(heard[0]!.options).toEqual({ level: "warning" });
		expect(heard[0]!.error.message.split("\n")[0]).toBe(
			"`MessageChannel` comes from the experimental fill of `@sohedra/lynx-polyfill/messaging`: it may change in any minor release, and not all of its web platform tests pass on Lynx yet.",
		);
		expect((heard[0]!.error as Error & { code: string }).code).toBe("fill_experimental");
	});

	it("says nothing when fetch is called: fetch is stable", async () => {
		const { fillBackground } = await import("../../src/fills/background.ts");
		const heard = hearWarnings();
		const scope: Record<string, unknown> = {};
		const lynx = {
			reportError: (error: Error, options: unknown) => void heard.push({ error, options }),
			fetch: () => new Promise(() => {}),
		};
		fillBackground({
			scope,
			readLynx: () => lynx,
			timers: { setTimeout, clearTimeout, setInterval, clearInterval },
			console: { log() {}, warn() {}, error() {} },
		});
		void (scope["fetch"] as (url: string) => Promise<unknown>)("https://a.example/").catch(
			() => {},
		);
		expect(heard).toEqual([]);
	});

	it("says nothing in a production build", async () => {
		rs.stubEnv("NODE_ENV", "production");
		const { fillUrlPattern } = await import("../../src/fills/web/url-pattern.ts");
		const heard = hearWarnings();
		const scope: Record<string, unknown> = {};
		fillUrlPattern(scope);
		void scope["URLPattern"];
		expect(heard).toEqual([]);
	});
});
