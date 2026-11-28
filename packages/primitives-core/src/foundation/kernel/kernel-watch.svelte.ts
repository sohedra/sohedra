// The API is modelled on runed's `watch` (https://github.com/svecosystem/runed, MIT); no code is
// copied. Unlike runed, each source is compared with `Object.is` and the callback runs only when
// one of them changed.
import { untrack } from "svelte";

/** What a watch callback may return: a cleanup to run before the next call and on destroy. */
type WatchCleanup = void | (() => void);

type Getters<T extends readonly unknown[]> = { readonly [K in keyof T]: () => T[K] };
type Unset<T extends readonly unknown[]> = { [K in keyof T]: T[K] | undefined };

export interface WatchOptions {
	/**
	 * Skip the first run: the callback runs only once a source differs from its value when `watch`
	 * was called, and `previous` is that value. Without it the callback also runs on the first
	 * run, with `previous` `undefined`.
	 * @default false
	 */
	lazy?: boolean;
}

interface WatchFunction {
	<T>(
		source: () => T,
		callback: (value: T, previous: T) => WatchCleanup,
		options: WatchOptions & { lazy: true },
	): void;
	<T>(
		source: () => T,
		callback: (value: T, previous: T | undefined) => WatchCleanup,
		options?: WatchOptions,
	): void;
	<const T extends readonly unknown[]>(
		sources: Getters<T>,
		callback: (values: T, previous: T) => WatchCleanup,
		options: WatchOptions & { lazy: true },
	): void;
	<const T extends readonly unknown[]>(
		sources: Getters<T>,
		callback: (values: T, previous: Unset<T>) => WatchCleanup,
		options?: WatchOptions,
	): void;
}

type AnyCallback = (value: unknown, previous: unknown) => WatchCleanup;

function create(
	pre: boolean,
	sources: (() => unknown) | readonly (() => unknown)[],
	callback: AnyCallback,
	options: WatchOptions | undefined,
): void {
	const multiple = Array.isArray(sources);
	const getters: readonly (() => unknown)[] = multiple ? sources : [sources as () => unknown];
	// Every source is read on every run, so each one stays tracked.
	const read = () => getters.map((get) => get());
	let previous = options?.lazy ? untrack(read) : undefined;
	let cleanup: WatchCleanup;

	const run = () => {
		const values = read();
		const last = previous;
		if (last && values.every((value, index) => Object.is(value, last[index]))) {
			return;
		}
		previous = values;
		untrack(() => {
			cleanup?.();
			const before = last ?? getters.map(() => undefined);
			cleanup = multiple ? callback(values, before) : callback(values[0], before[0]);
		});
	};
	// An effect's teardown also runs before each re-run, so the cleanup lives in a second effect
	// that never re-runs: it tears down only on destroy.
	const destroy = () => () => {
		untrack(() => cleanup?.());
		cleanup = undefined;
	};

	if (pre) {
		$effect.pre(run);
		$effect.pre(destroy);
	} else {
		$effect(run);
		$effect(destroy);
	}
}

/**
 * Runs `callback(value, previous)` when `source()` changes (`Object.is`), or, given an array of
 * sources, `callback(values, previous)` when at least one of them changes. Only the sources are
 * tracked: the callback runs inside `untrack`. It may return a cleanup, which runs before the next
 * call and on destroy. It runs on the first run too, unless `lazy` (see `WatchOptions.lazy`).
 * `watch.pre` does the same in an `$effect.pre`. Call during component init or inside
 * `$effect.root`.
 */
export const watch: WatchFunction & { readonly pre: WatchFunction } = Object.assign(
	((sources: never, callback: AnyCallback, options?: WatchOptions) =>
		create(false, sources, callback, options)) as WatchFunction,
	{
		pre: ((sources: never, callback: AnyCallback, options?: WatchOptions) =>
			create(true, sources, callback, options)) as WatchFunction,
	},
);
