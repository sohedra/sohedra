// The hooks lynx-core calls on the app (`updateCardData`, `updateGlobalProps`, `onAppReload`,
// `callDestroyLifetimeFun`): `mountPage` keeps one that code set before it, such as another library
// that binds the page as the entry's modules load, and calls it after its own work, with the same
// arguments, on the app. lynx-stack's lynx-runtime chains to the hook it finds the same way.

import { describe, expect, it } from "@rstest/core";

import { initData } from "../../../src/background/host-entry.ts";
import HostData from "../../fixtures/threads/host/HostData.svelte";
import Titled from "../../fixtures/threads/page/Titled.svelte";
import { startSveltePage } from "../svelte-page.ts";

const HOOKS = ["updateCardData", "updateGlobalProps", "onAppReload", "callDestroyLifetimeFun"];

/** Sets a hook for each name on the app that records its calls, as another library's would. */
function earlierHooks() {
	const calls: { hook: string; args: unknown[]; self: unknown }[] = [];
	let app: Record<string, unknown> | undefined;
	return {
		calls,
		app: () => app,
		beforeMount(target: Record<string, unknown>) {
			app = target;
			for (const hook of HOOKS)
				target[hook] = function (this: unknown, ...args: unknown[]) {
					calls.push({ hook, args, self: this });
				};
		},
	};
}

describe("the app's hooks set before mountPage", () => {
	it("still run at a data update, after the page has the data", async () => {
		const earlier = earlierHooks();
		let seen: unknown;
		const page = startSveltePage(HostData, {
			initData: { title: "Inbox" },
			beforeMount: (app) => {
				earlier.beforeMount(app);
				const own = app["updateCardData"] as (...args: unknown[]) => void;
				app["updateCardData"] = function (this: unknown, ...args: unknown[]) {
					seen = initData.current["title"];
					own.apply(this, args);
				};
			},
		});
		await page.settle();
		page.updateData({ title: "Archive" });
		await page.settle();
		expect(page.engine.text(page.byClass("title"))).toBe("Archive");
		expect(earlier.calls).toEqual([
			{ hook: "updateCardData", args: [{ title: "Archive" }, { type: 0 }], self: earlier.app() },
		]);
		expect(seen).toBe("Archive");
		expect(page.errors).toEqual([]);
	});

	it("still run at a global props update, after the page shows them", async () => {
		const earlier = earlierHooks();
		const page = startSveltePage(HostData, {
			globalProps: { theme: "light" },
			beforeMount: earlier.beforeMount,
		});
		await page.settle();
		page.updateGlobalProps({ theme: "dark" });
		await page.settle();
		expect(page.engine.text(page.byClass("theme"))).toBe("dark");
		expect(earlier.calls.map(({ hook }) => hook)).toEqual(["updateGlobalProps"]);
		expect(earlier.calls[0]!.args).toEqual([{ theme: "dark" }]);
		expect(earlier.calls[0]!.self).toBe(earlier.app());
		expect(page.errors).toEqual([]);
	});

	it("still run at a reload, after the page mounts again", async () => {
		const earlier = earlierHooks();
		const page = startSveltePage(Titled, {
			initData: { title: "Inbox" },
			props: (data) => ({ title: String(data["title"]) }),
			beforeMount: earlier.beforeMount,
		});
		await page.settle();
		page.reload({ title: "Sent" });
		await page.settle();
		expect(page.engine.texts()[0]).toBe("Sent");
		expect(earlier.calls.map(({ hook }) => hook)).toEqual(["onAppReload"]);
		expect(earlier.calls[0]!.args).toEqual([{ title: "Sent" }]);
		expect(page.errors).toEqual([]);
	});

	it("still run as the page ends, after the page's own end", async () => {
		const earlier = earlierHooks();
		const page = startSveltePage(Titled, { beforeMount: earlier.beforeMount });
		await page.settle();
		page.destroy();
		await page.settle();
		expect(earlier.calls.map(({ hook }) => hook)).toEqual(["callDestroyLifetimeFun"]);
		expect(earlier.calls[0]!.self).toBe(earlier.app());
		expect(page.errors).toEqual([]);
	});
});
