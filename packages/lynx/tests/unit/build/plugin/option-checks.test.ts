// The options of `pluginSvelteLynx()` are checked when the plugin is made, and one error lists
// every mistake, each with its fix and docs link.

import { describe, expect, it } from "@rstest/core";

import { pluginSvelteLynx } from "../../../../src/build/plugin/index.ts";
import { checkPluginOptions } from "../../../../src/build/plugin/option-checks.ts";

/** The error `options` raise; undefined when they pass. */
function rejection(options: Record<string, unknown>): (Error & { code?: string }) | undefined {
	try {
		checkPluginOptions(options);
	} catch (error) {
		return error as Error;
	}
	return undefined;
}

/** The first line of each message in the error: the sentences. */
function sentences(options: Record<string, unknown>): string[] {
	const error = rejection(options);
	if (error === undefined) return [];
	return error.message.split("\n\n\n").map((message) => message.split("\n")[0]!);
}

describe("the six options", () => {
	it("pass for every option with the type it documents", () => {
		expect(
			rejection({
				engineVersion: "4.3",
				firstFrame: (entryName: string) => entryName === "main",
				define: { mainThread: { __API__: '"x"', __N__: 1, __ON__: true, __NONE__: null } },
				dedupe: ["zustand", "@acme/state"],
				pageConfig: { enableCSSRule: true, longPressDuration: 400, tapSlop: "5px" },
				svelte: { configFile: "svelte.config.js" },
			}),
		).toBeUndefined();
		expect(rejection({})).toBeUndefined();
		// An option left undefined is not set.
		expect(rejection({ engineVersion: undefined, firstFrame: undefined })).toBeUndefined();
	});

	it("fail for a wrong type, naming the option, what it takes and what it got", () => {
		const wrong: [string, unknown, string][] = [
			["engineVersion", 4.2, "`engineVersion` must be a version string such as '4.2'; got 4.2."],
			[
				"firstFrame",
				"yes",
				'`firstFrame` must be a boolean or a function of the entry\'s name that returns one; got "yes".',
			],
			["define", "x", '`define` must be an object with `mainThread` and `background`; got "x".'],
			[
				"svelte",
				"svelte.config.js",
				'`svelte` must be an object such as { configFile }; got "svelte.config.js".',
			],
			["svelte", { configFile: 1 }, "`svelte.configFile` must be a path; got 1."],
			["svelte", { compilerOptions: {} }, "`svelte.compilerOptions` is not an option"],
			[
				"pageConfig",
				["enableCSSRule"],
				'`pageConfig` must be an object of page-config keys; got ["enableCSSRule"].',
			],
		];
		for (const [name, value, expected] of wrong) {
			const [sentence] = sentences({ [name]: value });
			expect(sentence, name).toContain(expected);
		}
	});

	it("carry the code of the first mistake, which is the docs page", () => {
		expect(rejection({ firstFrame: 1 })?.code).toBe("plugin_option_type");
		expect(rejection({ firstframe: 1 })?.code).toBe("unknown_plugin_option");
	});
});

describe("an unknown option", () => {
	it("names the closest known one", () => {
		const error = rejection({ firstframe: false });
		expect(error?.message.split("\n")[0]).toBe(
			"`firstframe` is not an option of `pluginSvelteLynx()`.",
		);
		expect(error?.message).toContain("Did you mean `firstFrame`?");
		expect(rejection({ engineVersoin: "4.3" })?.message).toContain("Did you mean `engineVersion`?");
	});

	it("lists the options when nothing is close", () => {
		const message = rejection({ nonsense: 1 })?.message ?? "";
		expect(message).not.toContain("Did you mean");
		expect(message).toContain(
			"The options are `engineVersion`, `firstFrame`, `define`, `dedupe`, `pageConfig` and `svelte`.",
		);
	});

	it("is listed once for each option", () => {
		expect(sentences({ nonsense: 1, alsoWrong: 2 })).toEqual([
			"`nonsense` is not an option of `pluginSvelteLynx()`.",
			"`alsoWrong` is not an option of `pluginSvelteLynx()`.",
		]);
	});
});

describe("an option of Svelte's, which svelte.config.js sets", () => {
	it("is unknown here, with a pointer to where it goes", () => {
		for (const name of ["compilerOptions", "preprocess"]) {
			const error = rejection({ [name]: {} });
			expect(error?.code).toBe("unknown_plugin_option");
			expect(error?.message.split("\n")[0]).toBe(
				`\`${name}\` is not an option of \`pluginSvelteLynx()\`.`,
			);
			expect(error?.message).toContain("Set it in svelte.config.js");
		}
	});

	it("is the same under `svelte`, named with its path", () => {
		const error = rejection({ svelte: { compilerOptions: {} } });
		expect(error?.message.split("\n")[0]).toBe(
			"`svelte.compilerOptions` is not an option of `pluginSvelteLynx()`.",
		);
		expect(error?.message).toContain("Set it in svelte.config.js");
	});

	it("keeps no history of options this package never had: any other name is just unknown", () => {
		for (const name of ["renderer", "enableCSSInheritance", "enableNewGesture"]) {
			const error = rejection({ [name]: true });
			expect(error?.code, name).toBe("unknown_plugin_option");
			expect(error?.message, name).not.toContain("any more");
			expect(error?.message, name).not.toContain("Remove it");
		}
	});
});

describe("define", () => {
	it("refuses a key the plugin sets itself, on either thread", () => {
		for (const thread of ["mainThread", "background"])
			for (const key of ["__MAIN_THREAD__", "__BACKGROUND__", "__LEPUS__", "__JS__", "__DEV__"])
				expect(sentences({ define: { [thread]: { [key]: "1" } } }), `${thread}.${key}`).toEqual([
					`\`define.${thread}.${key}\` is set by the plugin.`,
				]);
	});

	it("takes strings, numbers, booleans and null for values, and plain identifiers for keys", () => {
		expect(
			rejection({
				define: { mainThread: { A: '"x"', B_1: 1, $c: false, d: null }, background: {} },
			}),
		).toBeUndefined();
		expect(rejection({ define: {} })).toBeUndefined();
	});

	it("rejects what is not an object, an unknown thread, a bad key and a bad value", () => {
		expect(sentences({ define: [] })[0]).toContain("`define` must be an object");
		expect(sentences({ define: { worker: {} } })).toEqual(["`define.worker` is not a thread."]);
		expect(sentences({ define: { mainThread: "x" } })[0]).toContain(
			"`define.mainThread` must be an object of constants",
		);
		expect(sentences({ define: { mainThread: { "a.b": 1 } } })).toEqual([
			"`define.mainThread.a.b` is not a plain identifier.",
		]);
		expect(sentences({ define: { background: { A: {} } } })[0]).toContain(
			"`define.background.A` must be a string, a number, a boolean or null; got {}.",
		);
		expect(sentences({ define: { background: { A: () => 1 } } })[0]).toContain("got a function.");
	});
});

describe("dedupe", () => {
	it("takes a list of package names, scoped ones included", () => {
		expect(rejection({ dedupe: [] })).toBeUndefined();
		expect(rejection({ dedupe: ["zustand", "@acme/shared-state"] })).toBeUndefined();
	});

	it("rejects anything else, naming the option", () => {
		for (const value of [
			"zustand",
			1,
			{ zustand: true },
			[1],
			[""],
			["./local"],
			["/abs/path"],
			["zustand/middleware"],
		])
			expect(sentences({ dedupe: value })[0], JSON.stringify(value)).toMatch(
				/^`dedupe` must be a list of package names such as 'zustand' or '@acme\/state'; got /,
			);
	});
});

describe("pageConfig", () => {
	it("takes any key with a boolean, a number, a string or a list of strings", () => {
		expect(
			rejection({
				pageConfig: {
					enableCSSRule: true,
					longPressDuration: 400,
					tapSlop: "5px",
					customCSSInheritanceList: ["direction"],
					someKeyOfALaterEngine: false,
				},
			}),
		).toBeUndefined();
	});

	it("rejects a value of another type, naming the key", () => {
		for (const value of [{}, null, [1], () => {}])
			expect(sentences({ pageConfig: { enableCSSRule: value } })[0]).toContain(
				"`pageConfig.enableCSSRule` must be a boolean, a number, a string or a list of strings; got ",
			);
	});

	it("rejects each key the plugin sets itself, and says where the engine version goes", () => {
		for (const key of [
			"enableA11y",
			"targetSdkVersion",
			"enableRemoveCSSScope",
			"dsl",
			"filename",
			"enableEventHandleRefactor",
			"debugMetadataUrl",
		])
			expect(sentences({ pageConfig: { [key]: true } }), key).toEqual([
				`\`pageConfig.${key}\` is set by the plugin.`,
			]);
		expect(rejection({ pageConfig: { targetSdkVersion: "3.9" } })?.message).toContain(
			"`engineVersion`",
		);
	});
});

describe("every mistake at once", () => {
	it("lists each on its own, in the order of the options", () => {
		expect(
			sentences({
				engineVersion: 4.2,
				firstframe: 1,
				dedupe: ["./local"],
				define: { worker: {} },
			}),
		).toEqual([
			"`firstframe` is not an option of `pluginSvelteLynx()`.",
			"`engineVersion` must be a version string such as '4.2'; got 4.2.",
			"`define.worker` is not a thread.",
			"`dedupe` must be a list of package names such as 'zustand' or '@acme/state'; got [\"./local\"].",
		]);
	});

	it("is what pluginSvelteLynx() throws when it is made", () => {
		expect(() => pluginSvelteLynx({ firstFrame: 1, dedupe: "x" } as never)).toThrow(
			/`firstFrame` must be[^]*`dedupe` must be/,
		);
		expect(() => pluginSvelteLynx({})).not.toThrow();
	});
});
