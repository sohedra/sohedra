// `self` and `navigator`: WinterTC's Minimum Common API § 6 "The global scope" and § 7
// "User-Agent", with HTML § 8.9.1 "The Navigator object". Both threads lack them; on the background
// both names are parameters of Lynx's runtime wrapper, bound to `undefined`, which Sohedra's
// build renames so the bundle's code reads these (an app built otherwise reads `globalThis.self`). `navigator` has `product` and `userAgent` only:
// `Lynx/<engine version> (<platform>)`, an RFC 7231 product and comment, as `Lynx/4.2 (Android)`.

import type { Scope, ThreadLynx } from "../globals.ts";
import { installLazy } from "../install.ts";

/** @workaround web-navigator kind=lynx-gap delete-when="Lynx's threads have the global self and navigator" */
export function fillNavigator(scope: Scope, readLynx: () => ThreadLynx): void {
	installLazy(scope, "self", () => scope);
	installLazy(scope, "navigator", () => createNavigator(scope, readLynx));
}

/** The thread's `navigator`, from what its Lynx says about the device. */
export function createNavigator(
	scope: Scope,
	readLynx: () => ThreadLynx,
): { readonly product: string; readonly userAgent: string } {
	// Boundary: the background's global `SystemInfo`; the main thread has it on `lynx`.
	const info = (scope["SystemInfo"] ??
		readLynx().SystemInfo ??
		{}) as ThreadLynx["SystemInfo"] & {};
	const version = info.engineVersion ?? "";
	const platform = info.platform ?? "";
	return Object.freeze({
		product: "Lynx",
		userAgent: `Lynx${version ? `/${version}` : ""}${platform ? ` (${platform})` : ""}`,
	});
}
