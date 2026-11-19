// The development guard against a main-thread update loop: past its limit of flushes before the
// main thread's next turn, it reports the loop once and stops the flushes until that turn.

import { describe, expect, it } from "@rstest/core";

import { createLoopGuard, LOOP_LIMIT } from "../../../../src/main-thread/functions/loop-guard.ts";

describe("the update loop guard", () => {
	it("lets the limit's flushes through, then reports once and stops them until the next turn", () => {
		const reports: unknown[] = [];
		let turn: (() => void) | undefined;
		const guard = createLoopGuard({
			report: (error) => void reports.push(error),
			nextTurn: (callback) => {
				turn = callback;
				return true;
			},
		});
		guard.ran("a1b2:c3d4:1", "layoutchange");
		guard.changed("setStyleProperty", "height");
		let through = 0;
		for (let flush = 0; flush < LOOP_LIMIT + 5; flush++) if (guard.flush()) through++;
		expect(through).toBe(LOOP_LIMIT);
		expect(reports).toEqual([
			expect.objectContaining({
				code: "main_thread_update_loop",
				message: expect.stringContaining(
					"The last to run was a1b2:c3d4:1, for the event layoutchange.",
				),
			}),
		]);
		turn!();
		expect(guard.flush()).toBe(true);
	});

	it("lets every flush through where the engine has no timer", () => {
		const guard = createLoopGuard({ report: () => {}, nextTurn: () => false });
		for (let flush = 0; flush < LOOP_LIMIT + 5; flush++) expect(guard.flush()).toBe(true);
	});
});
