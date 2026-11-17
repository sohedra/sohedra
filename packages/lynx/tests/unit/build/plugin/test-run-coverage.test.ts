// A test run under Rstest's coverage: the coverage plugin reads Rsbuild's script rule after the
// plugin has set it up, and instruments what that rule compiles.

import { createRsbuild } from "@rsbuild/core";
import type { Rspack } from "@rsbuild/core";
import { describe, expect, it } from "@rstest/core";
import { pluginCoverage } from "@rstest/coverage-istanbul";

import { pluginSvelteLynx } from "../../../../src/build/plugin/index.ts";
import { APP_ROOT } from "../app.ts";

type RuleSetRule = Rspack.RuleSetRule;

/** Every rule of a config, nested ones too. */
function rulesOf(rules: readonly unknown[]): RuleSetRule[] {
	return rules.flatMap((rule) => {
		if (typeof rule !== "object" || rule === null) return [];
		const own = rule as RuleSetRule;
		return [own, ...rulesOf(own.oneOf ?? []), ...rulesOf(own.rules ?? [])];
	});
}

/** The loaders a rule uses, as Rspack reads them. */
function loadersOf(rule: RuleSetRule): unknown[] {
	const uses = Array.isArray(rule.use) ? rule.use : rule.use === undefined ? [] : [rule.use];
	return uses.map((use) => (typeof use === "string" ? use : (use as { loader?: unknown }).loader));
}

/** The Rspack config of a test run of this package, with Rstest's coverage plugin after ours. */
async function testRunConfig(): Promise<Rspack.Configuration> {
	const rsbuild = await createRsbuild({
		callerName: "rstest",
		cwd: APP_ROOT,
		rsbuildConfig: {
			plugins: [
				pluginSvelteLynx(),
				// Boundary: Rstest normalizes the coverage options; the plugin reads only `exclude`.
				pluginCoverage({ exclude: [] } as never),
			],
		},
	});
	const [config] = await rsbuild.initConfigs();
	return config!;
}

describe("a test run under Rstest's coverage", { timeout: 30_000 }, () => {
	it("leaves every rule with a loader to run", async () => {
		const rules = rulesOf((await testRunConfig()).module?.rules ?? []);
		const missing = rules.filter((rule) => loadersOf(rule).some((loader) => !loader));
		expect(missing).toEqual([]);
	});

	it("instruments the scripts the test run compiles, with the thread's constants kept", async () => {
		const rules = rulesOf((await testRunConfig()).module?.rules ?? []);
		const swcOptions = rules
			.flatMap((rule) => (Array.isArray(rule.use) ? rule.use : []))
			.filter((use) => (use as { loader?: string }).loader === "builtin:swc-loader")
			.map((use) => (use as { options: Record<string, never> }).options);
		const plugins = swcOptions.map((options) =>
			JSON.stringify(options["jsc"]?.["experimental"]?.["plugins"] ?? []),
		);
		expect(plugins.every((list) => list.includes("swc-plugin-coverage-instrument"))).toBe(true);
		const globals = swcOptions.map((options) =>
			JSON.stringify(options["jsc"]?.["transform"]?.["optimizer"]?.["globals"] ?? {}),
		);
		expect(globals.every((vars) => vars.includes("__BACKGROUND__"))).toBe(true);
	});
});
