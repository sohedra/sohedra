// A test run's first-frame copies: a component imported with the query `?first-frame` is its
// main-thread copy (../loaders/first-frame-copy.ts), which it and all it imports compile in the main
// thread's layer, with the main thread's resolve conditions, as a build's first frame does. Each
// component of the test run imports its own and hangs it on itself, for `render` from
// `@sohedra/lynx/testing`.

import type { Rspack } from "@rsbuild/core";

import { SERVER_RUNTIME_MODULE } from "../../svelte/build/index.ts";
import { LAYERS, RUNTIME_FILES, loaderPath } from "./layers.ts";
import { mainThreadConditions, SVELTE_SERVER_ALIASES } from "./resolve.ts";

/** The test of the component rule, `/\.svelte$/`, as its source. */
const SVELTE_COMPONENT = "\\.svelte$";

/** The query that imports a component's first-frame copy. */
const FIRST_FRAME_QUERY = /[?&]first-frame(?:&|$)/;

/**
 * Adds the rule of first-frame copies to a test run's finished config: `pluginSvelteLynx` makes the
 * component rule after its own setup has read the app's Svelte config, so the chain has no rule yet
 * when its setup runs.
 */
export function addFirstFrameCopies(config: Rspack.Configuration, development: boolean): void {
	const rules = (config.module ??= {}).rules ?? [];
	const component = rules.find(
		(rule): rule is Rspack.RuleSetRule =>
			typeof rule === "object" &&
			rule !== null &&
			rule.test instanceof RegExp &&
			rule.test.source === SVELTE_COMPONENT &&
			Array.isArray(rule.oneOf),
	);
	// Without `pluginSvelteLynx`'s rules there is no component to copy.
	if (!component) return;
	// The copy's own module starts the main thread's layer, before the thread branches.
	component.oneOf!.unshift({
		resourceQuery: FIRST_FRAME_QUERY,
		layer: LAYERS["main-thread"],
		use: [
			{ loader: loaderPath("first-frame-copy"), options: { entry: RUNTIME_FILES.firstFrameEntry } },
		],
	});
	config.module.rules = [
		...rules,
		{
			issuerLayer: LAYERS["main-thread"],
			resolve: { conditionNames: mainThreadConditions(development) },
		},
		{
			issuerLayer: LAYERS["main-thread"],
			issuer: SERVER_RUNTIME_MODULE,
			resolve: { alias: { ...SVELTE_SERVER_ALIASES } },
		},
	];
}
