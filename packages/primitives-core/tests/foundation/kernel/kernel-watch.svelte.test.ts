// watch: when its callback runs (lazy or not, on a change, never on an equal value), what it
// receives, what it tracks, its cleanup, and watch.pre's place before other effects.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { watch } from "../../../src/foundation/kernel/index.js";
import { root } from "../../kit/kit-effects.svelte.js";

describe("watch", () => {
	it("is lazy by default: skips the first run and compares with the value at the call", () => {
		let value = $state(1);
		const calls: [number, number][] = [];
		root(() =>
			watch(
				() => value,
				(next, previous) => void calls.push([next, previous]),
				{ lazy: true },
			),
		);
		flushSync();
		expect(calls).toEqual([]);

		value = 2;
		flushSync();
		expect(calls).toEqual([[2, 1]]);
	});

	it("runs when the value changed between the call and the first run", () => {
		let value = $state(1);
		const calls: [number, number][] = [];
		root(() =>
			watch(
				() => value,
				(next, previous) => void calls.push([next, previous]),
				{ lazy: true },
			),
		);
		value = 2;
		flushSync();
		expect(calls).toEqual([[2, 1]]);
	});

	it("with lazy: false, also runs on the first run with an undefined previous value", () => {
		let value = $state(1);
		const calls: [number, number | undefined][] = [];
		root(() =>
			watch(
				() => value,
				(next, previous) => void calls.push([next, previous]),
				{ lazy: false },
			),
		);
		flushSync();
		expect(calls).toEqual([[1, undefined]]);

		value = 2;
		flushSync();
		expect(calls).toEqual([
			[1, undefined],
			[2, 1],
		]);
	});

	it("does not run when the source re-evaluates to an equal value", () => {
		let source = $state({ a: 1, b: 1 });
		let runs = 0;
		root(() =>
			watch(
				() => source.a,
				() => {
					runs++;
				},
				{ lazy: true },
			),
		);
		flushSync();
		// A new object with the same `a`: the getter re-runs and returns an equal value.
		source = { a: 1, b: 2 };
		flushSync();
		expect(runs).toBe(0);

		source = { a: 2, b: 2 };
		flushSync();
		expect(runs).toBe(1);
	});

	it("compares with Object.is, never deeply", () => {
		let value = $state.raw({ n: 1 });
		let nan = $state(Number.NaN);
		let runs = 0;
		root(() =>
			watch(
				[() => value, () => nan],
				() => {
					runs++;
				},
				{ lazy: true },
			),
		);
		flushSync();
		nan = Number.NaN;
		flushSync();
		expect(runs).toBe(0);

		value = { n: 1 };
		flushSync();
		expect(runs).toBe(1);
	});

	it("runs when one of several sources changes, with every value and every previous value", () => {
		let a = $state(1);
		let b = $state("x");
		const calls: unknown[] = [];
		root(() =>
			watch(
				[() => a, () => b],
				(values, previous) => {
					calls.push([values, previous]);
				},
				{ lazy: true },
			),
		);
		flushSync();

		b = "y";
		flushSync();
		expect(calls).toEqual([
			[
				[1, "y"],
				[1, "x"],
			],
		]);

		a = 2;
		b = "y";
		flushSync();
		expect(calls).toHaveLength(2);
		expect(calls[1]).toEqual([
			[2, "y"],
			[1, "y"],
		]);
	});

	it("passes an array of undefined as the previous values on a non-lazy first run", () => {
		const a = $state(1);
		const b = $state(2);
		const calls: unknown[] = [];
		root(() =>
			watch([() => a, () => b], (values, previous) => void calls.push([values, previous]), {
				lazy: false,
			}),
		);
		flushSync();
		expect(calls).toEqual([
			[
				[1, 2],
				[undefined, undefined],
			],
		]);
	});

	it("tracks only the sources: state read in the callback does not re-run it", () => {
		const value = $state(1);
		let other = $state(1);
		let runs = 0;
		root(() =>
			watch(
				() => value,
				() => {
					void other;
					runs++;
				},
				{ lazy: false },
			),
		);
		flushSync();
		other = 2;
		flushSync();
		expect(runs).toBe(1);
	});

	it("runs the cleanup before the next callback and on destroy, not on an equal re-run", () => {
		let source = $state({ a: 1 });
		const log: string[] = [];
		const destroy = root(() =>
			watch(
				() => source.a,
				(value) => {
					log.push(`run ${value}`);
					return () => log.push(`cleanup ${value}`);
				},
				{ lazy: false },
			),
		);
		flushSync();
		source = { a: 1 };
		flushSync();
		expect(log).toEqual(["run 1"]);

		source = { a: 2 };
		flushSync();
		expect(log).toEqual(["run 1", "cleanup 1", "run 2"]);

		destroy();
		expect(log).toEqual(["run 1", "cleanup 1", "run 2", "cleanup 2"]);
	});

	describe("watch.pre", () => {
		it("runs before the effects scheduled after it", () => {
			let value = $state(1);
			const log: string[] = [];
			root(() => {
				$effect(() => {
					log.push(`effect ${value}`);
				});
				watch.pre(
					() => value,
					(next) => {
						log.push(`pre ${next}`);
					},
				);
			});
			flushSync();
			log.length = 0;

			value = 2;
			flushSync();
			expect(log).toEqual(["pre 2", "effect 2"]);
		});

		it("has the same comparison and cleanup", () => {
			let source = $state({ a: 1 });
			const log: string[] = [];
			const destroy = root(() =>
				watch.pre(
					() => source.a,
					(value, previous) => {
						log.push(`run ${value} from ${previous}`);
						return () => log.push(`cleanup ${value}`);
					},
					{ lazy: true },
				),
			);
			flushSync();
			source = { a: 1 };
			flushSync();
			expect(log).toEqual([]);

			source = { a: 2 };
			flushSync();
			source = { a: 3 };
			flushSync();
			destroy();
			expect(log).toEqual(["run 2 from 1", "cleanup 2", "run 3 from 2", "cleanup 3"]);
		});
	});
});
