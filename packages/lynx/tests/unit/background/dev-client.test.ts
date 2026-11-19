// The binding's part of Lynx's dev client: build errors reach LogBox, a load DevTool cannot do is
// said once, and a hot update that lands after Svelte threw loads the page again.

import { afterEach, describe, expect, it } from "@rstest/core";

import {
	reloadAfterCrash,
	reloadNeedsDevTool,
	reportBuildErrors,
} from "../../../src/background/dev-client.ts";
import type { HotUpdates } from "../../../src/background/dev-client.ts";
import { runSvelte, setErrorHandler, startOver } from "../../../src/background/errors.ts";
import { clearRepeats, reportError } from "../../../src/background/report.ts";
import { installGlobals } from "../../../src/testing/globals.ts";

let restore = (): void => {};
afterEach(() => {
	restore();
	setErrorHandler(undefined);
	clearRepeats();
});

/** A background with `lynx` and the host's native modules; what it was asked, in order. */
function host(modules?: Record<string, Record<string, unknown>>) {
	const reports: { error: Error; level: string }[] = [];
	const reloads: unknown[] = [];
	restore = installGlobals({
		lynx: {
			reportError: (error: Error, options?: { level?: string }) =>
				void reports.push({ error, level: options?.level ?? "error" }),
			reload: (data: unknown, callback: unknown) => {
				expect(typeof callback).toBe("function");
				reloads.push(data);
			},
		},
		NativeModules: modules,
	});
	return { reports, reloads };
}

describe("reportBuildErrors", () => {
	it("reports the build's errors into Lynx as one error, without the terminal's colors", () => {
		const { reports } = host();
		reportBuildErrors(["\u001B[31merror\u001B[39m src/App.svelte:3:9 Unexpected token"]);
		expect(reports).toHaveLength(1);
		const { error, level } = reports[0]!;
		expect(level).toBe("error");
		expect((error as Error & { code?: string }).code).toBe("build_failed");
		expect(error.message.split("\n")[0]).toBe(
			"The app's last change did not build, so the page still runs the app as it was.",
		);
		expect(error.message).toContain("error src/App.svelte:3:9 Unexpected token");
		expect(error.message).not.toContain("\u001B");
	});

	it("takes the errors as the dev server's object too, and says how many more there are past five", () => {
		const { reports } = host();
		reportBuildErrors({ text: ["a", "b", "c", "d", "e", "f", "g"] });
		const { message } = reports[0]!.error;
		expect(message).toContain("\n\ne\n\nAnd 2 more: the terminal shows all.");
		expect(message).not.toContain("\n\nf\n");
	});
});

describe("reloadNeedsDevTool", () => {
	it("leaves the load to DevTool where its module is there and DevTool is on, in either spelling", () => {
		for (const name of ["LynxDevToolSetModule", "LynxDevtoolSetModule"]) {
			const { reports } = host({ [name]: { invokeCdp() {}, isDevToolEnabled: () => true } });
			expect(reloadNeedsDevTool()).toBe(false);
			expect(reports).toEqual([]);
		}
	});

	it("leaves it to DevTool where its module cannot say whether DevTool is on", () => {
		host({ LynxDevToolSetModule: { invokeCdp() {} } });
		expect(reloadNeedsDevTool()).toBe(false);
		host({
			LynxDevToolSetModule: {
				invokeCdp() {},
				isDevToolEnabled() {
					throw new Error("not here");
				},
			},
		});
		expect(reloadNeedsDevTool()).toBe(false);
	});

	it("says once, as a warning, that the page needs DevTool where DevTool is off, as Lynx Explorer's switch leaves it", () => {
		const { reports } = host({
			LynxDevToolSetModule: { invokeCdp() {}, isDevToolEnabled: () => false },
		});
		expect(reloadNeedsDevTool()).toBe(true);
		expect(reloadNeedsDevTool()).toBe(true);
		expect(
			reports.map(({ error, level }) => [(error as Error & { code?: string }).code, level]),
		).toEqual([["reload_needs_devtool", "warning"]]);
	});

	it("reads iOS's answer, a number, as on or off", () => {
		// A native BOOL reaches JavaScript as 0 or 1 on iOS, and as a boolean on Android.
		const off = host({ LynxDevToolSetModule: { invokeCdp() {}, isDevToolEnabled: () => 0 } });
		expect(reloadNeedsDevTool()).toBe(true);
		expect(off.reloads).toEqual([]);
		host({ LynxDevToolSetModule: { invokeCdp() {}, isDevToolEnabled: () => 1 } });
		expect(reloadNeedsDevTool()).toBe(false);
	});

	it("says so too where the host has no DevTool module, or no native modules at all", () => {
		host({});
		expect(reloadNeedsDevTool()).toBe(true);
		host(undefined);
		expect(reloadNeedsDevTool()).toBe(true);
	});
});

describe("reloadAfterCrash", () => {
	/** The bundler's hot API, whose status the test moves. */
	function hot(): HotUpdates & { status(...statuses: string[]): void } {
		const handlers: ((status: string) => void)[] = [];
		return {
			addStatusHandler: (handler) => void handlers.push(handler),
			status: (...statuses) => {
				for (const status of statuses) for (const handler of handlers) handler(status);
			},
		};
	}

	/** Svelte throws while it flushes, as a component's effect does. */
	const svelteThrows = (): void =>
		expect(() =>
			runSvelte(() => {
				throw new Error("the child threw");
			}),
		).toThrow("the child threw");

	it("loads the page again when a hot update lands after Svelte threw", () => {
		const { reloads } = host();
		const updates = hot();
		reloadAfterCrash(updates);
		setErrorHandler(undefined);
		svelteThrows();
		updates.status("check", "prepare", "ready", "dispose", "apply");
		expect(reloads).toEqual([]);
		updates.status("idle");
		expect(reloads).toEqual([{}]);
	});

	it("leaves the page when Svelte threw nothing since it started or reloaded", () => {
		const { reloads } = host();
		const updates = hot();
		reloadAfterCrash(updates);
		setErrorHandler(undefined);
		updates.status("check", "prepare", "ready", "dispose", "apply", "idle");
		svelteThrows();
		startOver();
		updates.status("check", "prepare", "ready", "dispose", "apply", "idle");
		expect(reloads).toEqual([]);
	});

	it("leaves the page when an update does not land", () => {
		const { reloads } = host();
		const updates = hot();
		reloadAfterCrash(updates);
		setErrorHandler(undefined);
		svelteThrows();
		updates.status("check", "prepare", "ready", "abort", "idle");
		updates.status("check", "prepare", "ready", "dispose", "apply", "fail");
		expect(reloads).toEqual([]);
	});

	it("leaves the page after an error the app reported", () => {
		const { reloads } = host();
		const updates = hot();
		reloadAfterCrash(updates);
		setErrorHandler(undefined);
		reportError(new Error("the request failed"));
		updates.status("check", "prepare", "ready", "dispose", "apply", "idle");
		expect(reloads).toEqual([]);
	});

	it("does nothing without the bundler's hot API, as in a test or a build without hot updates", () => {
		expect(() => reloadAfterCrash(undefined)).not.toThrow();
	});
});
