import { compile } from "svelte/compiler";
import type { CompileOptions } from "svelte/compiler";

/** What a component's script declares, so that a test's markup can use `x`, `el` and `fn`. */
const SCRIPT = "<script>let x = $state(0); let el; const fn = () => {};</script>";

/** The renderer module's name in compiled output when a test does not run the component. */
export const RENDERER_MODULE = "@sohedra/lynx/internal/renderer";

/** The options the binding gives the compiler for a background-thread component. */
export function clientOptions(
	experimental: Record<string, unknown> = {},
	renderer: string = RENDERER_MODULE,
): CompileOptions {
	return {
		filename: "Contract.svelte",
		generate: "client",
		fragments: "tree",
		runes: true,
		css: "external",
		experimental: { customRenderer: renderer, ...experimental },
	};
}

/** The client output for `markup`, under the custom renderer, with `x`, `el` and `fn` in scope. */
export function compileClient(
	markup: string,
	experimental: Record<string, unknown> = {},
	options: CompileOptions = {},
): string {
	return compile(`${SCRIPT}${markup}`, { ...clientOptions(experimental), ...options }).js.code;
}

/** The server output (what the first frame runs) for `markup`. */
export function compileServer(markup: string): string {
	return compile(`${SCRIPT}${markup}`, {
		filename: "Contract.svelte",
		generate: "server",
		runes: true,
		css: "external",
	}).js.code;
}
