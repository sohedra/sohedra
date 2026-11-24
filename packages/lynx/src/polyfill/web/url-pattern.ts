// `URLPattern`: the URL Pattern Standard § 1 "URL patterns", by urlpattern-polyfill. Both threads
// lack it. One of the four extra fills: a thread's script carries it only where the usage scan
// sees the name, or through its escape-hatch import. The package checks a group's name with
// Unicode property escapes (`\p{ID_Start}`, `\p{ID_Continue}`), which PrimJS refuses: the vendoring
// writes them out as the code points they stand for (scripts/polyfill/bundle.ts).
//
// The package reads the global `URL` each time it parses, never as it loads, so it parses with the
// thread's `URL`: the URL fill's where the thread's own gets URLs wrong.
//
// Leaves out: a pattern whose own regular expression has a Unicode property escape (`(\p{L}+)`)
// fails at run time on PrimJS, which refuses the escape in `new RegExp`, as it does everywhere.

import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { URLPattern } from "../vendor/url-pattern.js";

/** @workaround web-url-pattern kind=lynx-gap delete-when="Lynx's threads have a global URLPattern" */
export function fillUrlPattern(scope: Scope): void {
	installLazy(scope, "URLPattern", () => named(URLPattern, "URLPattern"), isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";
