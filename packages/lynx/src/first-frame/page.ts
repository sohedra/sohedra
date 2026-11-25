// `mountPage` on the main thread, where `@sohedra/lynx` resolves to ./root-entry.ts. The page's
// entry runs on both threads. Here `mountPage` records how to draw the page's first frame: Svelte's
// server renderer, from the page's initial data, before the background runs. The main thread's
// runtime draws it when the engine renders the page, and the background's first patch adopts what
// it drew (hydration). Effects, handlers and attachments never run here.

import type { Component } from "svelte";
import { render } from "svelte/server";

import { FIRST_FRAME_GLOBAL, PROPS_ID_PREFIX, wireError } from "../wire/index.ts";
import type { Thread } from "../wire/index.ts";
import { firstFrameDevelopmentError } from "./catalogue.ts";
import { whileDrawing } from "./drawing.ts";
import { DEV, DRAWS, firstFrame, hasGlobal, setGlobalFunction } from "./globals.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own bound on props
type Bag = Record<string, any>;

/** How the page starts: the background's options, which the first frame draws with too. */
export interface MountPageOptions<Props extends Bag> {
	props?:
		| Props
		| ((initData: Record<string, unknown>, globalProps: Record<string, unknown>) => Props);
	// oxlint-disable-next-line typescript/no-explicit-any -- Svelte's own type of a context
	context?: Map<any, any>;
	/**
	 * The background's: the main thread's errors reach it there. The first frame never calls it.
	 */
	onError?: (
		error: Error,
		context: { thread: Thread; component: string | undefined; code: string | undefined },
	) => void;
}

/** Svelte's error when a component awaits while the page renders synchronously. */
const AWAIT_INVALID = "await_invalid";

/**
 * Records how to draw the page's first frame: its markup, from the initial data and the host's
 * global props, or `null` when the page has none (a component awaits outside a `pending` boundary,
 * as on Svelte's server). A second call keeps the first's record, and is reported.
 */
export function mountPage<Props extends Bag>(
	App: Component<Props>,
	...[options = {}]: {} extends Props
		? [options?: MountPageOptions<NoInfer<Props>>]
		: // `props` given: what it holds, `MountPageOptions` checks.
			[options: MountPageOptions<NoInfer<Props>> & { props: {} }]
): void {
	if (!DRAWS) return;
	if (hasGlobal(FIRST_FRAME_GLOBAL)) {
		firstFrame.lynx.reportError(
			wireError({ code: "page_already_mounted", details: { thread: "main-thread" } }),
		);
		return;
	}
	let warned = false;
	setGlobalFunction(FIRST_FRAME_GLOBAL, (initData: Record<string, unknown>): string | null => {
		const { props, context } = options;
		const given =
			typeof props === "function" ? props(initData, firstFrame.lynx.__globalProps ?? {}) : props;
		try {
			// Boundary: `render` takes the component's props as `Omit<Props, …>`, which `Props` is.
			return whileDrawing(
				initData,
				() =>
					render(App as Component<Record<string, unknown>>, {
						props: given ?? {},
						...(context && { context }),
						idPrefix: PROPS_ID_PREFIX,
					}).body,
			);
		} catch (error) {
			if (!(error instanceof Error) || !error.message.startsWith(AWAIT_INVALID)) throw error;
			if (DEV && !warned) {
				warned = true;
				firstFrame.lynx.reportError(
					firstFrameDevelopmentError({
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
