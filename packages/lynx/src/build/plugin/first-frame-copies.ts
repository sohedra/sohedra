// The binding's own tests: a component imported with the query `?first-frame` is its main-thread
// copy (../loaders/first-frame-copy.ts), which it and all it imports compile in the main thread's
// layer, with the main thread's resolve conditions, as a build's first frame does. Not part of the
// public test preset: the binding's `rstest.config.ts` adds it.

import type { RsbuildPlugin, Rspack } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { environment } from "../globals.ts";
import { LAYERS, RUNTIME_FILES, loaderPath } from "./layers.ts";
import { mainThreadConditions } from "./resolve.ts";

/** The test of the component rule, `/\.svelte$/`, as its source. */
const SVELTE_COMPONENT = "\\.svelte$";

/** The query that imports a component's first-frame copy. */
const FIRST_FRAME_QUERY = /[?&]first-frame(?:&|$)/;

/** First-frame copies of components, for a test run with `pluginSvelteLynx`'s rules. */
export function pluginFirstFrameCopies(): RsbuildPlugin {
	return {
		name: `${PACKAGE_NAME}:first-frame-copies`,
		setup(api) {
			// On the finished config: `pluginSvelteLynx` makes the component rule after its own setup has
			// read the app's Svelte config, so the chain has no rule yet when this plugin's setup runs.
			// As the test run's own rules: development unless NODE_ENV says production.
			const development = environment["NODE_ENV"] !== "production";
			api.modifyRspackConfig((config) => {
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
						{
							loader: loaderPath("first-frame-copy"),
							options: { entry: RUNTIME_FILES.firstFrameEntry },
						},
					],
				});
				config.module.rules = [
					...rules,
					{
						issuerLayer: LAYERS["main-thread"],
						resolve: { conditionNames: mainThreadConditions(development) },
					},
				];
			});
		},
	};
}
