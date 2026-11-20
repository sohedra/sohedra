// Which requests resolve from the app's folder (`svelte` and the packages named in `singleCopy`),
// and which from this package's; and the conditions each thread resolves with.

import { createRsbuild } from "@rsbuild/core";
import type { Rspack } from "@rsbuild/core";
import { describe, expect, it } from "@rstest/core";

import { LAYERS } from "../../../../src/build/plugin/layers.ts";
import { configureResolve, requestsOf } from "../../../../src/build/plugin/resolve.ts";
import { APP_ROOT } from "../app.ts";

describe("requestsOf", () => {
	const requests = requestsOf(["svelte", "zustand", "@acme/state"]);

	it("takes a package's name, and a path into it", () => {
		for (const request of [
			"svelte",
			"svelte/internal/client",
			"zustand",
			"zustand/vanilla",
			"@acme/state",
			"@acme/state/store",
		])
			expect(requests.test(request), request).toBe(true);
	});

	it("takes no other package whose name starts the same, nor a scope without the package", () => {
		for (const request of [
			"svelte-check",
			"svelte-lynx",
			"zustand-persist",
			"@acme",
			"@acme/other",
		])
			expect(requests.test(request), request).toBe(false);
	});

	it("takes a name with characters that mean something in a pattern as that name", () => {
		const odd = requestsOf(["a.b", "c+d"]);
		expect(odd.test("a.b")).toBe(true);
		expect(odd.test("axb")).toBe(false);
		expect(odd.test("c+d/sub")).toBe(true);
		expect(odd.test("ccd")).toBe(false);
	});
});

describe("configureResolve", { timeout: 30_000 }, () => {
	it("resolves Svelte's custom-renderer entries on the background, and its server build on the main thread", async () => {
		const rsbuild = await createRsbuild({
			cwd: APP_ROOT,
			rsbuildConfig: { tools: { bundlerChain: (chain) => configureResolve(chain, false) } },
		});
		const [config] = await rsbuild.initConfigs();
		expect(config!.resolve?.conditionNames).toContain("svelte-custom-renderer");
		// Boundary: the rules of a config are its own objects.
		const rules = (config!.module?.rules ?? []) as Rspack.RuleSetRule[];
		const mainThread = rules.find((rule) => rule.issuerLayer === LAYERS["main-thread"]);
		expect(mainThread!.resolve!.conditionNames).toContain("worker");
		expect(mainThread!.resolve!.conditionNames).not.toContain("svelte-custom-renderer");
	});
});
