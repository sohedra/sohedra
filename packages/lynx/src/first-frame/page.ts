// The page's entry on the main thread, where `@sohedra/lynx/internal/page` resolves to this. The
// entry runs on both threads. Here its `startPage` records how to draw the page's first frame:
// Svelte's server renderer, from the page's initial data, before the background runs. The main
// thread's runtime draws it when the engine renders the page, and the background's first patch
// adopts what it drew (hydration). Effects, handlers and attachments never run here.

import type { Component } from "svelte";
import { render } from "svelte/server";

import { FIRST_FRAME_GLOBAL, PROPS_ID_PREFIX } from "../wire/index.ts";
import { firstFrameError } from "./catalogue.ts";
import { DEV, DRAWS, firstFrame, setGlobalFunction } from "./globals.ts";

/** How the page starts: the background's options, of which the first frame reads `props`. */
export interface StartPageOptions<Props extends Record<string, unknown>> {
	props?: (initData: Record<string, unknown>) => Props;
}

/** Svelte's error when a component awaits while the page renders synchronously. */
const AWAIT_INVALID = "await_invalid";

/**
 * Records how to draw the page's first frame: its markup, from the initial data, or `null` when
 * the page has none (a component awaits outside a `pending` boundary, as on Svelte's server).
 */
export function startPage<Props extends Record<string, unknown>>(
	App: Component<Props>,
	options: StartPageOptions<Props> = {},
): void {
	if (!DRAWS) return;
	let warned = false;
	setGlobalFunction(FIRST_FRAME_GLOBAL, (initData: Record<string, unknown>): string | null => {
		// Boundary: an app without `props` has a root component that takes none.
		const props = options.props?.(initData) ?? ({} as Props);
		try {
			// Boundary: `render` takes the component's props as `Omit<Props, …>`, which `Props` is.
			return render(App as Component<Record<string, unknown>>, {
				props,
				idPrefix: PROPS_ID_PREFIX,
			}).body;
		} catch (error) {
			if (!(error instanceof Error) || !error.message.startsWith(AWAIT_INVALID)) throw error;
			if (DEV && !warned) {
				warned = true;
				firstFrame.lynx.reportError(
					firstFrameError({
						code: "first_frame_skipped_await",
						details: { component: App.name || "page" },
					}),
					{ level: "warning" },
				);
			}
			return null;
		}
	});
}
