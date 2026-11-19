// What compiling a component does around Svelte: the options it gives Svelte, the preprocessors it
// runs first, the modules it points the output at, and the errors it explains.

import { describe, expect, it } from "@rstest/core";

import { component, SERVER_INTERNALS } from "../compiling.ts";

describe("the options Svelte compiles with", () => {
	it("are the thread's own, whatever the app's config says", async () => {
		const options = { generate: "server", css: "injected", runes: false } as const;
		const background = await component("<view></view>", {
			thread: "background",
			compilerOptions: options,
		});
		expect(background.code).toContain("svelte/internal/client");
		expect(background.code).toContain("@sohedra/lynx/internal/renderer");
		const mainThread = await component("<view></view>", {
			thread: "main-thread",
			compilerOptions: options,
		});
		expect(mainThread.code).toContain(SERVER_INTERNALS);
		expect(mainThread.code).not.toContain("@sohedra/lynx/internal/renderer");
	});

	it("leave Svelte's development code out of the main thread's copy, and keep it on the background", async () => {
		const source = `<script>import Row from "./Row.svelte";</script><view><text>a</text><Row /></view>`;
		const mainThread = await component(source, { thread: "main-thread", development: true });
		expect(mainThread.code).not.toContain("push_element");
		expect(mainThread.code).not.toContain("$$renderer.component(");
		const production = await component(source, { thread: "main-thread" });
		expect(mainThread.code).toBe(production.code);
		const background = await component(source, { development: true });
		expect(background.code).toContain("$.add_locations(");
	});

	it("keep the app's other options", async () => {
		const { code } = await component("<view>   </view>", {
			compilerOptions: { preserveWhitespace: true },
		});
		expect(code).toContain("'   '");
	});

	it("name the component after its file, as an identifier", async () => {
		expect((await component("<view></view>", { file: "Card.svelte" })).code).toContain(
			"export default function Card(",
		);
		expect((await component("<view></view>", { file: "my-card.svelte" })).code).toContain(
			"export default function Svelte_my_card(",
		);
	});
});

describe("the modules the output imports", () => {
	it("are the build's own in place of Svelte's internals", async () => {
		const background = await component("<view></view>", {
			clientInternals: "/build/client-internals.js",
		});
		expect(background.code).toContain('"/build/client-internals.js"');
		expect(background.code).not.toContain("svelte/internal/client");
		const mainThread = await component("<view></view>", {
			thread: "main-thread",
			serverInternals: "/build/server-internals.js",
		});
		expect(mainThread.code).toContain('"/build/server-internals.js"');
		expect(mainThread.code).not.toContain("svelte/internal/server");
	});

	it("are written as literals that no character of a path can leave", async () => {
		const { code } = await component("<view></view>", {
			clientInternals: "/build/a<b>\u2028/client.js",
		});
		expect(code).toContain('"/build/a\\u003cb\\u003e\\u2028/client.js"');
	});
});

describe("preprocessors", () => {
	it("run first, and their output is what is compiled", async () => {
		const { code, dependencies } = await component("<view>__NAME__</view>", {
			preprocess: [
				{
					markup: ({ content }) => ({
						code: content.replace("__NAME__", "Ada"),
						dependencies: ["/a/b.txt"],
					}),
				},
			],
		});
		expect(code).toContain("Ada");
		expect(dependencies).toEqual(["/a/b.txt"]);
	});

	it("keep the map to the file on disk, with its text", async () => {
		const source = "<view>__NAME__</view>";
		const { map } = await component(source, {
			sourceMap: true,
			preprocess: [{ markup: ({ content }) => ({ code: content.replace("__NAME__", "Ada") }) }],
		});
		expect(map!.sourcesContent).toEqual([source]);
	});
});

describe("<svelte:boundary>", () => {
	const boundary =
		"<svelte:boundary>\n\t<view></view>\n\t{#snippet failed(error)}<text>oops</text>{/snippet}\n</svelte:boundary>";

	it("with a failed snippet compiles, with async support off or on", async () => {
		await expect(component(boundary)).resolves.toBeDefined();
		await expect(
			component(boundary, { compilerOptions: { experimental: { async: true } } }),
		).resolves.toBeDefined();
	});
});
