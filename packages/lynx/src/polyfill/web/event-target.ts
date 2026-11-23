// `EventTarget`: DOM § 2.7. Both threads lack it.

import EventTargetFill from "@ungap/event-target";

import type { Scope } from "../globals.ts";
import { installLazy } from "../install.ts";

/**
 * Svelte's runtime tests values with `instanceof EventTarget`, unguarded, as it copies state
 * (`$state.snapshot`, and so `$inspect` and `{@debug}`) and as it walks an action's object
 * (svelte/src/internal/shared/clone.js, internal/client/runtime.js), on both threads.
 *
 * @workaround web-event-target kind=lynx-gap delete-when="Lynx's threads have a global EventTarget"
 */
export function fillEventTarget(scope: Scope): void {
	installLazy(scope, "EventTarget", () => EventTargetFill, isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";
