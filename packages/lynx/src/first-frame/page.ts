// The page's entry on the main thread, where `@sohedra/lynx/internal/page` resolves to this. The
// entry runs on both threads: here for the main-thread functions it defines, which register as it
// loads. The page itself is the background's, so starting it here draws nothing.

import type { Component } from "svelte";

/** How the page starts: the background's options, which the main thread does not read. */
export interface StartPageOptions<Props extends Record<string, unknown>> {
	props?: (initData: Record<string, unknown>) => Props;
}

/** The main thread's copy of the page's start: the background's page draws it. */
export function startPage<Props extends Record<string, unknown>>(
	_App: Component<Props>,
	_options?: StartPageOptions<Props>,
): void {}
