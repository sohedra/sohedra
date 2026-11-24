// The warning an experimental fill gives the first time an app uses it, in a development build: the
// four fills past the WinterTC baseline (`EventSource`, the compression streams, `URLPattern`, the
// `MessageChannel` family), until their tests pass on PrimJS and an Android and an iOS run pass.

import { polyfillError } from "./catalogue.ts";
import { isDevelopment, readLynx } from "./globals.ts";

const warned = new Set<string>();

/**
 * `load`, which first warns that the fill of `module` is experimental, once per module, in a
 * development build. `global` is the name being read.
 */
export function experimental<T>(module: string, global: string, load: () => T): () => T {
	return () => {
		warnOnce(module, global);
		return load();
	};
}

/** Warns that the fill of `module` is experimental, the first time, in a development build. */
function warnOnce(module: string, global: string): void {
	if (warned.has(module) || !isDevelopment()) return;
	warned.add(module);
	try {
		readLynx().reportError(polyfillError("fill_experimental", { global, module }), {
			level: "warning",
		});
	} catch {
		// A warning must never stop the fill.
	}
}
