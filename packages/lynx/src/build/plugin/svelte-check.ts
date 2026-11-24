// The Svelte the app installed must have custom renderers (5.59 or newer), and be in the range this
// package was tested with: checked once, when the plugin is set up, so the mistake shows as one
// message and not as an error in every component, or as a page that breaks on a device. The range
// is the one this package's package.json gives `svelte` as a peer, so it is written in one place.

import { createRequire } from "node:module";
import path from "node:path";

import { svelteCompiler } from "../../svelte/build/index.ts";
import { RENDERER_ENTRY } from "../../wire/index.ts";
import { buildError } from "../diagnostics/messages.ts";
import { PACKAGE_ROOT } from "./layers.ts";
import { satisfiesRange } from "./version-range.ts";

/** The range of Svelte versions this package was tested with: its peer range for `svelte`. */
function testedSvelteRange(): string {
	// Boundary: this package's package.json, read at run time.
	const manifest = createRequire(import.meta.url)(path.join(PACKAGE_ROOT, "package.json")) as {
		peerDependencies: Record<string, string>;
	};
	return manifest.peerDependencies["svelte"] ?? "unknown";
}

/**
 * Throws the build's message when the app in `root` has no Svelte, a Svelte without custom
 * renderers, or a Svelte outside the range this package was tested with (a prerelease is outside
 * every range).
 */
export function checkSvelte(root: string): void {
	const range = testedSvelteRange();
	let compiler: ReturnType<typeof svelteCompiler>;
	try {
		compiler = svelteCompiler(root);
	} catch {
		throw buildError({ code: "svelte_missing", details: { root, range } });
	}
	try {
		compiler.compile("<view></view>", { experimental: { customRenderer: RENDERER_ENTRY } });
	} catch (error) {
		// Boundary: Svelte's errors carry a code.
		if ((error as { code?: unknown } | null)?.code !== "options_unrecognised") throw error;
		throw buildError({
			code: "svelte_without_renderers",
			details: { version: compiler.VERSION, where: root, range },
		});
	}
	if (satisfiesRange(compiler.VERSION, range)) return;
	throw buildError({
		code: "svelte_version_unverified",
		details: { version: compiler.VERSION, where: root, range },
	});
}
