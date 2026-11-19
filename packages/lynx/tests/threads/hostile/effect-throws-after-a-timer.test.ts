// An effect that throws when a timer's change runs it. Svelte runs that change's effects from the
// background's `queueMicrotask`, and with no boundary rethrows out of it: the binding's own
// microtask entry, since Lynx's background has no `queueMicrotask`. The throw used to leave the
// binding there, unreported by it and unheard by `onError`; the fake's background had the
// process's `queueMicrotask`, so no test went through the binding's.

import { describe, expect, it } from "@rstest/core";

import TimerEffect from "../../fixtures/threads/errors/TimerEffect.svelte";
import { lynxTimer, tapAndWait } from "../errors/lynx-timer.ts";
import { startSveltePage } from "../svelte-page.ts";
import type { SveltePage } from "../svelte-page.ts";

describe("an effect that throws when a timer's change runs it", () => {
	it("is reported once, onError hears it once, and the page goes on", async () => {
		const heard: string[] = [];
		const made: { page?: SveltePage } = {};
		const page = startSveltePage(TimerEffect, {
			props: { later: lynxTimer(() => made.page!) },
			onError: (error) => void heard.push(error.message.split("\n")[0]!),
		});
		made.page = page;
		await page.settle();
		const tap = (): Promise<void> => tapAndWait(page, "more");
		await tap();
		expect(page.errors.map((error) => (error as Error).message.split("\n")[0])).toEqual([
			"the effect threw at 1",
		]);
		expect(heard).toEqual(["the effect threw at 1"]);
		await tap();
		expect(page.engine.text(page.byClass("more"))).toBe("2");
		expect(page.errors).toHaveLength(1);
	});
});
