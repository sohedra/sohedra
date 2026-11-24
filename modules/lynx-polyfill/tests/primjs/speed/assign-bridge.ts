// Times PrimJS's own `Object.assign` against the one `/language` puts in its place (core-js's), on
// the copies apps make most: a few keys into a new object, and a wider object's keys. The engine's
// own is read as this module loads, before the thread's fills run (thread-script.ts).

import { report } from "../realm.ts";

const native = Object.assign;

/** Milliseconds `assign` takes for each kind of copy, the best of three runs. */
function timings(assign: typeof Object.assign): { small: number; wide: number } {
	const small = { a: 1, b: "two", c: true };
	const wide: Record<string, number> = {};
	for (let index = 0; index < 30; index++) wide[`key${index}`] = index;
	const best = (run: () => void): number => {
		let fastest = Infinity;
		for (let round = 0; round < 3; round++) {
			const start = Date.now();
			run();
			fastest = Math.min(fastest, Date.now() - start);
		}
		return fastest;
	};
	return {
		small: best(() => {
			for (let index = 0; index < 200_000; index++) assign({}, small);
		}),
		wide: best(() => {
			for (let index = 0; index < 20_000; index++) assign({}, wide);
		}),
	};
}

/** Reports the engine's and the fill's timings, and whether the fill replaced the engine's. */
export function connectAssignSpeed(): void {
	const replaced = Object.assign;
	const engine = timings(native);
	const filled = timings(replaced);
	report({
		replaced: replaced !== native,
		nativeSmall: engine.small,
		nativeWide: engine.wide,
		filledSmall: filled.small,
		filledWide: filled.wide,
	});
}
