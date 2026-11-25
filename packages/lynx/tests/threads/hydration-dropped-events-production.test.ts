// A production page pairs early events as a development page does, and drops one hydration made
// again saying nothing of it: the warning is development only (./hydration-dropped-events.test.ts).

import { describe, expect, it, rs } from "@rstest/core";

import * as globals from "../../src/main-thread/globals.ts" with { rstest: "importActual" };
import BesideBackgroundOnly from "../fixtures/threads/early/BesideBackgroundOnly.svelte";
import drawBesideBackgroundOnly from "../fixtures/threads/early/BesideBackgroundOnly.svelte?first-frame";
import Session from "../fixtures/threads/early/Session.svelte";
import drawSession from "../fixtures/threads/early/Session.svelte?first-frame";

rs.mock("../../src/main-thread/globals.ts", () => ({ ...globals, DEV: false }));

const { startSveltePage } = await import("./svelte-page.ts");

describe("an early tap, in a production build", () => {
	it("beside a part only the background renders, runs its own handler", async () => {
		const log: unknown[] = [];
		const page = startSveltePage(BesideBackgroundOnly, {
			props: () => ({ log }),
			firstFrame: { draw: drawBesideBackgroundOnly, props: { log } },
		});
		page.engine.dispatch(page.byClass("tapped"), { type: "tap" });
		await page.settle();
		expect(log).toEqual(["tapped", "outer"]);
		expect(page.warnings).toEqual([]);
		expect(page.errors).toEqual([]);
	});

	it("in a branch the background did not take, runs no handler, and is neither warned about nor reported", async () => {
		const log: unknown[] = [];
		const heard: unknown[] = [];
		const page = startSveltePage(Session, {
			props: () => ({ user: "ada", log }),
			firstFrame: { draw: drawSession, props: { log } },
			onError: (error) => void heard.push(error),
		});
		page.engine.dispatch(page.byClass("login"), { type: "tap" });
		await page.settle();
		expect(log).toEqual([]);
		expect(page.warnings).toEqual([]);
		expect(page.errors).toEqual([]);
		expect(heard).toEqual([]);
	});
});
