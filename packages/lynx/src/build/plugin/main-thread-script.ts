// What the main thread's script needs from Rspack's settings, whatever the app sets.
//
// Lynx loads the main thread's script as one piece (the template's lepus code), with no way to
// load a chunk there, and it must not be wrapped in a function that runs at once. The
// background's scripts are the app's to split.

import type { ModifyRspackConfigUtils, RsbuildConfig, Rspack } from "@rsbuild/core";

import { buildWarning } from "../diagnostics/messages.ts";

/** The main thread's entry is its page entry's name and this. */
export const MAIN_THREAD_ENTRY_SUFFIX = "__main-thread";

/** Whether `name` is the name of a Lynx build's environment (`lynx`, `lynx-*`): the others are not this plugin's. */
export const isLynxEnvironment = (name: string): boolean =>
	name === "lynx" || name.startsWith("lynx-");

/**
 * Whether the app has its say on split chunks in the environment `name`: a `splitChunks` (the
 * environment's own first; `false` too), or a `performance.chunkSplit` strategy (the
 * environment's own first) that is not `all-in-one`, which is also what none means. `original` is
 * the config as the app wrote it.
 */
export function appSetsSplitChunks(original: RsbuildConfig, name: string): boolean {
	const own = original.environments?.[name];
	if ((own?.splitChunks ?? original.splitChunks) !== undefined) return true;
	const strategy =
		own?.performance?.chunkSplit?.strategy ?? original.performance?.chunkSplit?.strategy;
	return strategy !== undefined && strategy !== "all-in-one";
}

type SplitChunks = Exclude<
	NonNullable<NonNullable<Rspack.Configuration["optimization"]>["splitChunks"]>,
	false
>;
type Chunks = NonNullable<SplitChunks["chunks"]>;

/**
 * Whether only main-thread code runs from the chunk: the main thread's entry, and what it loads
 * with `import()` (a lazy bundle's main-thread script). For an entry `main` with
 * `import('./Page')`:
 *
 * | chunk             | `chunk.name`        | `chunk.runtime`       |
 * | ----------------- | ------------------- | --------------------- |
 * | entry background  | `main`              | `[main]`              |
 * | entry main-thread | `main__main-thread` | `[main__main-thread]` |
 * | Page background   | `undefined`         | `[main]`              |
 * | Page main-thread  | `undefined`         | `[main__main-thread]` |
 */
const isMainThreadChunk = (chunk: Rspack.Chunk): boolean =>
	[...chunk.runtime].every((runtime) => runtime.endsWith(MAIN_THREAD_ENTRY_SUFFIX));

/**
 * The chunks an app's `chunks` setting selects, except the main thread's and the lazy bundles':
 * a lazy bundle's background is one script too. The template plugin names all of a bundle's
 * background chunks alike (`lazy-bundle/<name>/background.js`, a conflict for a second one), and
 * the runtime runs only the bundle's first, its `background` section. A lazy chunk is the one no
 * entry loads at once (`canBeInitial`); what the page loads is split as before, also when a lazy
 * bundle imports it as well.
 */
function pageBackgroundOnly(chunks: Chunks | undefined): (chunk: Rspack.Chunk) => boolean {
	let selected: (chunk: Rspack.Chunk) => boolean;
	if (typeof chunks === "function") selected = chunks;
	else if (chunks instanceof RegExp)
		selected = (chunk) => chunk.name !== undefined && chunks.test(chunk.name);
	else if (chunks === "all") selected = () => true;
	else if (chunks === "initial") selected = (chunk) => chunk.canBeInitial();
	// Rspack's own default (the async chunks): all of them are lazy bundles, so none is left.
	else selected = (chunk) => !chunk.canBeInitial();
	return (chunk) => !isMainThreadChunk(chunk) && chunk.canBeInitial() && selected(chunk);
}

/**
 * The app's `optimization.splitChunks`, with no chunk of the main thread to split: not by the
 * top-level setting, nor by a cache group's or the fallback group's own.
 */
export function splitBackgroundOnly(splitChunks: SplitChunks): SplitChunks {
	const { cacheGroups, fallbackCacheGroup } = splitChunks;
	return {
		...splitChunks,
		chunks: pageBackgroundOnly(splitChunks.chunks),
		...(cacheGroups && {
			cacheGroups: Object.fromEntries(
				Object.entries(cacheGroups).map(([name, group]) => [
					name,
					group && group.chunks !== undefined
						? { ...group, chunks: pageBackgroundOnly(group.chunks) }
						: group,
				]),
			),
		}),
		...(fallbackCacheGroup?.chunks !== undefined && {
			fallbackCacheGroup: {
				...fallbackCacheGroup,
				chunks: pageBackgroundOnly(fallbackCacheGroup.chunks),
			},
		}),
	};
}

/**
 * The plugin's `tools.rspack`: the last of the app's, so that it sees what the app set, in a Lynx
 * environment only.
 *
 * - `splitChunks`: never splits the main thread's script, nor a lazy bundle's background script,
 *   whatever the app sets.
 * - `output.iife`: false. Rspack has one setting for the main thread and the background, and the
 *   main thread's script must not be wrapped (ReactLynx does the same); an app that sets another
 *   value is told, through `warn`, that it is ignored.
 */
export function mainThreadScriptWhole(
	warn: (message: string) => void,
): (config: Rspack.Configuration, utils: ModifyRspackConfigUtils) => void {
	return (config, { environment }) => {
		if (!isLynxEnvironment(environment.name)) return;
		const { splitChunks } = config.optimization ?? {};
		if (splitChunks)
			config.optimization = {
				...config.optimization,
				splitChunks: splitBackgroundOnly(splitChunks),
			};
		const iife = config.output?.iife;
		if (iife !== undefined && iife !== false)
			warn(buildWarning({ code: "iife_ignored", details: { value: String(iife) } }).message);
		config.output = { ...config.output, iife: false };
	};
}
