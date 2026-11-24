// `URL` and `URLSearchParams`: the URL Standard § 6 "API", by whatwg-url-minimum, as Expo's. The main
// thread lacks both; the background has lynx-core's `URL`, which gets most of a URL wrong (no
// `pathname`, no `search`, a relative URL not resolved), and its `URLSearchParams`. Both are
// replaced together, so a `URL`'s `searchParams` is the global `URLSearchParams`. Svelte's
// `SvelteURL` and `SvelteURLSearchParams` extend them. Leaves out what whatwg-url-minimum leaves
// out: `blob:` URLs' origins.

import type { Scope } from "../globals.ts";
import { holds, installLazy } from "../install.ts";
import { URL, URLSearchParams } from "../vendor/url.js";

/** @workaround web-url kind=lynx-gap delete-when="Lynx's threads have a global URL that parses as the URL Standard does" */
export function fillUrl(scope: Scope): void {
	if (parses(scope["URL"])) return;
	installLazy(scope, "URL", () => URL, never);
	installLazy(scope, "URLSearchParams", () => URLSearchParams, never);
}

const never = (): boolean => false;

/** Whether `existing` is a `URL` that parses, resolves and refuses as the standard does. */
function parses(existing: unknown): boolean {
	if (typeof existing !== "function") return false;
	// Boundary: the thread's own, checked as the standard one.
	const Url = existing as typeof URL;
	return holds(() => {
		const url = new Url("../x?q=1#h", "https://a.example:8080/b/c/d");
		return (
			url.href === "https://a.example:8080/b/x?q=1#h" &&
			url.pathname === "/b/x" &&
			url.searchParams.get("q") === "1" &&
			typeof Url.canParse === "function" &&
			!holds(() => {
				new Url("no scheme");
				return true;
			})
		);
	});
}
