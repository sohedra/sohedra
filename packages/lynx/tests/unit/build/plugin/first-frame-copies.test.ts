// The binding's own tests' first-frame copies: a rule that puts `./Card.svelte?first-frame` in the
// main thread's layer, before the component rule's thread branches, with the main thread's resolve
// conditions, and the module it makes.

import { createRsbuild } from "@rsbuild/core";
import type { RsbuildConfig, Rspack } from "@rsbuild/core";
import { describe, expect, it } from "@rstest/core";

import firstFrameCopyLoader from "../../../../src/build/loaders/first-frame-copy.ts";
import { pluginFirstFrameCopies } from "../../../../src/build/plugin/first-frame-copies.ts";
import { pluginSvelteLynx } from "../../../../src/build/plugin/index.ts";
import { LAYERS } from "../../../../src/build/plugin/layers.ts";
import { APP_ROOT } from "../app.ts";

type RuleSetRule = Rspack.RuleSetRule;

/** A rule's resource query as text, for one written as a pattern. */
const queryOf = (rule: RuleSetRule): string =>
	rule.resourceQuery instanceof RegExp ? rule.resourceQuery.source : "";

async function rulesOf(rsbuildConfig: RsbuildConfig): Promise<RuleSetRule[]> {
	const rsbuild = await createRsbuild({
		callerName: "rstest",
		cwd: APP_ROOT,
		rsbuildConfig,
	});
	const [config] = await rsbuild.initConfigs();
	// Boundary: the rules of a config are its own objects.
	return (config!.module?.rules ?? []) as RuleSetRule[];
}

describe("first-frame copies", { timeout: 30_000 }, () => {
	it("come first in the component rule, in the main thread's layer, with its conditions", async () => {
		const rules = await rulesOf({ plugins: [pluginSvelteLynx(), pluginFirstFrameCopies()] });
		const component = rules.find(
			(rule) => rule.test instanceof RegExp && rule.test.source === "\\.svelte$",
		);
		const [copy] = component!.oneOf as RuleSetRule[];
		expect(queryOf(copy!)).toContain("first-frame");
		expect(copy!.layer).toBe(LAYERS["main-thread"]);
		const resolve = rules.find(
			(rule) => rule.issuerLayer === LAYERS["main-thread"] && rule.resolve !== undefined,
		);
		expect(resolve!.resolve!.conditionNames).toContain("worker");
	});

	it("add nothing without the plugin's rules", async () => {
		const rules = await rulesOf({ plugins: [pluginFirstFrameCopies()] });
		expect(rules.some((rule) => queryOf(rule).includes("first-frame"))).toBe(false);
	});

	it("are a module that imports the component and records its first frame with mountPage", () => {
		const context = {
			getOptions: () => ({ entry: "/binding/first-frame/root-entry.ts" }),
			resourcePath: "/app/src/Card.svelte",
		};
		// Boundary: the loader reads only these two fields of its context.
		const code = firstFrameCopyLoader.call(context as never);
		expect(code).toContain('import Component from "./Card.svelte";');
		expect(code).toContain('import { mountPage } from "/binding/first-frame/root-entry.ts";');
		expect(code).toContain("mountPage(Component, { props, context });");
	});
});
