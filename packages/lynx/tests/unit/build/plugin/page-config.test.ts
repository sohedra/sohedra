// `pageConfig` is the one place for the page's Lynx settings. Some keys have an option of their
// own in the template plugin, and go to it; the engine's newer paths are set by the plugin last.

import { describe, expect, it } from "@rstest/core";

import {
	NEW_PATH_COMPILER_OPTIONS,
	NEW_PATH_PAGE_CONFIG,
	applyLynxConfig,
	resolvePageConfig,
} from "../../../../src/build/plugin/page-config.ts";

describe("resolvePageConfig", () => {
	it("sends the keys the template plugin has an option for to it, and keeps the others apart", () => {
		const { template, pageConfig } = resolvePageConfig({
			enableCSSInheritance: true,
			enableCSSInvalidation: false,
			enableCSSRule: true,
		});
		expect(template).toMatchObject({ enableCSSInheritance: true, enableCSSInvalidation: false });
		expect(pageConfig).toMatchObject({ enableCSSRule: true });
		expect(pageConfig).not.toHaveProperty("enableCSSInheritance");
	});

	it("starts from the template plugin's defaults, as the options had them", () => {
		expect(resolvePageConfig(undefined).template).toEqual({
			customCSSInheritanceList: undefined,
			debugInfoOutside: true,
			defaultDisplayLinear: true,
			enableAccessibilityElement: false,
			enableCSSInheritance: false,
			enableCSSInvalidation: true,
			removeDescendantSelectorScope: true,
		});
	});

	it("turns CSS variables on: a `--x` in a style does nothing on the engine without it", () => {
		expect(resolvePageConfig(undefined).pageConfig).toMatchObject({
			enableCSSInlineVariables: true,
		});
		expect(resolvePageConfig({ enableCSSInlineVariables: false }).pageConfig).toMatchObject({
			enableCSSInlineVariables: false,
		});
	});

	it("streams fetch's response bodies, unless the app turns it off", () => {
		expect(resolvePageConfig(undefined).pageConfig).toMatchObject({
			enableFetchAPIStandardStreaming: true,
		});
		expect(resolvePageConfig({ enableFetchAPIStandardStreaming: false }).pageConfig).toMatchObject({
			enableFetchAPIStandardStreaming: false,
		});
	});

	it("leaves out a key set to undefined", () => {
		const { pageConfig, template } = resolvePageConfig({
			enableCSSRule: undefined,
			enableCSSInheritance: undefined,
		} as never);
		expect(pageConfig).not.toHaveProperty("enableCSSRule");
		expect(template).toMatchObject({ enableCSSInheritance: false });
	});
});

describe("applyLynxConfig", () => {
	it("gives way to what pluginLynxConfig sets, which encodes its own keys", () => {
		const resolved = resolvePageConfig({
			enableCSSInheritance: true,
			enableCSSRule: true,
			enableFixedNew: true,
			enableCSSInlineVariables: true,
		});
		applyLynxConfig(resolved, { enableCSSInheritance: false, enableCSSRule: false });
		expect(resolved.template["enableCSSInheritance"]).toBe(false);
		expect(resolved.pageConfig).toMatchObject({ enableFixedNew: true });
		expect(resolved.pageConfig).not.toHaveProperty("enableCSSRule");
		expect(resolved.pageConfig).toMatchObject({ enableCSSInlineVariables: true });
	});
});

describe("the engine's newer paths", () => {
	it("are the keys whose default at Lynx 4.2 is the older path", () => {
		expect(Object.keys(NEW_PATH_PAGE_CONFIG).sort()).toEqual([
			"enableA11y",
			"enableAutoNonFlatten",
			"enableNativeList",
			"enableNewGesture",
			"enableNewIntersectionObserver",
			"enableNewSticky",
		]);
		expect(Object.values(NEW_PATH_PAGE_CONFIG).every((value) => value === true)).toBe(true);
		expect(NEW_PATH_COMPILER_OPTIONS).toEqual({ enableFiberArch: true, enableCSSSelector: true });
	});
});
