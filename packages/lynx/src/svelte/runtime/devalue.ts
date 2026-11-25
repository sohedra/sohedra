// What `devalue` is for Svelte's server runtime on the main thread: it imports it for `hydratable`
// alone, which only async server rendering reaches, and the first frame renders synchronously. The
// build points Svelte's import here, so a page's main-thread script leaves `devalue` out unless the
// app imports it itself (the contract row `devalue-for-hydratable`).

import { wireError } from "../../wire/index.ts";

/**
 * Throws: Svelte serializes with it only for `hydratable`, which has nothing to carry its value to
 * the background on Lynx.
 *
 * @workaround devalue-for-hydratable kind=svelte-internal delete-when="Svelte's server runtime imports devalue only where hydratable serializes, in a module a synchronous render does not load"
 */
export function uneval(_value: unknown, _replacer?: unknown): never {
	throw wireError({ code: "hydratable_not_on_lynx", details: {} });
}
