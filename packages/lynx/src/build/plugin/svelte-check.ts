// The Svelte the app installed must be the build with custom renderers: checked once, when the
// plugin is set up, so the mistake shows as one message and not as an error in every component.

import { svelteCompiler } from "../../svelte/build/index.ts";
import { RENDERER_ENTRY } from "../../wire/index.ts";
import { buildError } from "../diagnostics/messages.ts";

/** Throws the build's message when the app in `root` has no Svelte, or a Svelte without custom renderers. */
export function checkSvelte(root: string): void {
	let compiler: ReturnType<typeof svelteCompiler>;
	try {
		compiler = svelteCompiler(root);
	} catch {
		throw buildError({ code: "svelte_missing", details: { root } });
	}
	try {
		compiler.compile("<view></view>", { experimental: { customRenderer: RENDERER_ENTRY } });
	} catch (error) {
		// Boundary: Svelte's errors carry a code.
		if ((error as { code?: unknown } | null)?.code !== "options_unrecognised") throw error;
		throw buildError({
			code: "svelte_without_renderers",
			details: { version: compiler.VERSION, where: root },
		});
	}
}
