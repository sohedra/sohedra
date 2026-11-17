// `svelteConfig()` is the one line of an app's `svelte.config.js`. The editor reads it, and so
// does the plugin: both get the options a Lynx page needs, and the app's own on top.

import { describe, expect, it } from "@rstest/core";

import { svelteConfig } from "../../../../src/build/svelte-config/index.ts";
import { component } from "../compiling.ts";

describe("svelteConfig()", () => {
	it("turns on runes and the custom renderer, and nothing else", () => {
		const { compilerOptions, preprocess } = svelteConfig();
		expect(compilerOptions.runes).toBe(true);
		expect(compilerOptions.experimental).toEqual({
			customRenderer: "@sohedra/lynx/internal/renderer",
		});
		expect(preprocess).toEqual([]);
	});

	it("has no async default: Svelte's own is off, and the app's setting turns it on", () => {
		expect(svelteConfig().compilerOptions.experimental?.async).toBeUndefined();
		const config = svelteConfig({ compilerOptions: { experimental: { async: true } } });
		expect(config.compilerOptions.experimental).toEqual({
			async: true,
			customRenderer: "@sohedra/lynx/internal/renderer",
		});
	});

	it("keeps the app's compiler options and preprocessors", () => {
		const first = { markup: ({ content }: { content: string }) => ({ code: content }) };
		const second = { script: () => undefined };
		const config = svelteConfig({
			compilerOptions: { rootDir: "/app", preserveComments: true },
			preprocess: [first, second],
		});
		expect(config.compilerOptions).toMatchObject({ rootDir: "/app", preserveComments: true });
		expect(config.preprocess).toEqual([first, second]);
		expect(svelteConfig({ preprocess: first }).preprocess).toEqual([first]);
	});
});

describe("the warning filter", () => {
	const warning = (code: string) => ({ code }) as never;

	it("drops attribute_illegal_colon, which every main-thread attribute raises", () => {
		const { warningFilter } = svelteConfig().compilerOptions;
		expect(warningFilter?.(warning("attribute_illegal_colon"))).toBe(false);
		expect(warningFilter?.(warning("a11y_missing_attribute"))).toBe(true);
	});

	it("still runs the app's own filter for every other warning", () => {
		const seen: string[] = [];
		const { warningFilter } = svelteConfig({
			compilerOptions: {
				warningFilter: (found) => {
					seen.push(found.code);
					return found.code !== "state_referenced_locally";
				},
			},
		}).compilerOptions;
		expect(warningFilter?.(warning("attribute_illegal_colon"))).toBe(false);
		expect(warningFilter?.(warning("state_referenced_locally"))).toBe(false);
		expect(warningFilter?.(warning("css_unused_selector"))).toBe(true);
		expect(seen).toEqual(["state_referenced_locally", "css_unused_selector"]);
	});

	it("leaves a component with main-thread:ontap without a warning", async () => {
		const source = `<script>function tap() { 'main thread'; }</script>\n<view main-thread:ontap={tap}></view>\n`;
		const bare = await component(source, { thread: "background" });
		expect(bare.warnings.map((found) => found.code)).toContain("attribute_illegal_colon");
		const { compilerOptions } = svelteConfig();
		const { warnings } = await component(source, { thread: "background", compilerOptions });
		expect(warnings.map((found) => found.code)).not.toContain("attribute_illegal_colon");
	});
});
