// The loaders that patch Svelte's own text at build time. What each patch does is checked in
// tests/unit/svelte/build; this is what the loader does around it.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import primjsRegexLoader from "../../../../src/build/loaders/primjs-regex.ts";
import spreadSetterLoader from "../../../../src/build/loaders/svelte-spread-setter.ts";
import { runLoader } from "./loader-context.ts";

const require = createRequire(import.meta.url);
const svelteRoot = path.dirname(require.resolve("svelte/package.json"));
const read = (file: string): string => fs.readFileSync(path.join(svelteRoot, file), "utf8");

describe("the spread-setter loader", () => {
	const file = path.join(svelteRoot, "src/internal/client/reactivity/props.js");
	const run = (source: string) => runLoader(spreadSetterLoader, source, { file });

	it("gives Svelte's props code with the setter lookup added", async () => {
		const { code } = await run(read("src/internal/client/reactivity/props.js"));
		expect(code).toContain("lynx_spread_setter(props, key)");
	});

	it("fails the build, naming the anchor and the file, when Svelte's text has moved", async () => {
		const moved = read("src/internal/client/reactivity/props.js").replace(
			"get_descriptor(props, key)?.set ??",
			"/* moved */",
		);
		const { error } = await run(moved);
		expect(error).toMatchObject({ code: "spread_setter_moved", hideStack: true });
		expect(error?.message).toContain("props.js");
		expect(error?.message).toContain("get_descriptor(props, key)?.set ??");
	});
});

describe("the PrimJS regex loader", () => {
	it("rewrites the tag-name regex in Svelte's utils", async () => {
		const file = path.join(svelteRoot, "src/utils.js");
		const { code } = await runLoader(primjsRegexLoader, read("src/utils.js"), { file });
		expect(code).toMatch(
			/REGEX_VALID_TAG_NAME =\s*\/\^\[a-zA-Z\]\[a-zA-Z0-9\]\*\(-\[a-zA-Z0-9\._-\]\*\)\?\$\/;/,
		);
	});

	it("leaves another file alone", async () => {
		const result = await runLoader(primjsRegexLoader, "const a = 1;", { file: "other.js" });
		expect(result.code).toBe("const a = 1;");
	});

	it("warns, naming the regex and the file, when Svelte's declaration has moved", async () => {
		const file = path.join(svelteRoot, "src/utils.js");
		const source = read("src/utils.js").replace("REGEX_VALID_TAG_NAME", "RENAMED");
		const result = await runLoader(primjsRegexLoader, source, { file });
		expect(result.code).toBe(source);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]?.message).toContain("REGEX_VALID_TAG_NAME");
		expect(result.warnings[0]?.message).toContain("utils.js");
	});
});
