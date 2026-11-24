// Svelte's `SvelteURL` and `SvelteURLSearchParams` over the filled `URL`, on each thread: they extend
// the global `URL` and `URLSearchParams` (svelte/src/reactivity/url.js, url-search-params.js) as
// they load on the background, and read them on the main thread's server render
// (reactivity/index-server.js). The background has lynx-core's `URL`, which gets most of a URL wrong;
// the main thread has none.

import vm from "node:vm";

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../src/fills/globals.ts";
import { bundleEntry } from "./entry-script.ts";

/** What the app's script finds, written to `globalThis.result`. */
const APP = `
import { SvelteURL, SvelteURLSearchParams } from "svelte/reactivity";
const url = new SvelteURL("https://user@example.com:8080/a/b?x=1#h");
url.searchParams.append("y", "2 3");
const relative = new SvelteURL("../c?q", "https://example.com/a/b");
const params = new SvelteURLSearchParams("a=1&b=2&a=3");
params.sort();
globalThis.result = {
	href: url.href,
	pathname: url.pathname,
	search: url.search,
	port: url.port,
	username: url.username,
	hash: url.hash,
	relative: relative.href,
	params: params.toString(),
	all: params.getAll("a"),
	isURL: url instanceof URL,
};
`;

/** lynx-core's `URL` on the background, as wrong as the device's: no `pathname`, no `search`. */
class LynxCoreUrl {
	href: string;
	constructor(href: string) {
		this.href = href;
	}
}

/** Svelte's builds per thread: the client's on the background, the server's on the main thread. */
const CONDITIONS: Record<Thread, string[]> = { background: ["browser"], "main-thread": [] };

describe.each(["background", "main-thread"] as const)("on the %s", (thread) => {
	it("SvelteURL and SvelteURLSearchParams parse as the URL Standard does", async () => {
		const code = await bundleEntry({
			subpath: "/url",
			thread,
			minimize: false,
			after: APP,
			conditions: CONDITIONS[thread],
		});
		const context = vm.createContext({});
		const lynx = { reportError: (error: unknown) => void error };
		Object.assign(context, {
			lynx,
			queueMicrotask,
			...(thread === "background" && { URL: LynxCoreUrl }),
		});
		vm.runInContext(code, context);
		expect(context["result"]).toEqual({
			href: "https://user@example.com:8080/a/b?x=1&y=2+3#h",
			pathname: "/a/b",
			search: "?x=1&y=2+3",
			port: "8080",
			username: "user",
			hash: "#h",
			relative: "https://example.com/c?q",
			params: "a=1&a=3&b=2",
			all: ["1", "3"],
			isURL: true,
		});
	}, 60_000);
});
