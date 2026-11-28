// Server HTML in a browser test: rendered when the test runs, by the project's Vite server through
// a browser command, or given as a string, then put on the page and hydrated. A mismatch that
// hydration logs fails the test.
import { type Component, flushSync, hydrate, unmount } from "svelte";
import { onTestFinished, vi } from "vitest";
import { commands } from "vitest/browser";

import {
	type ConformanceSetup,
	type ServerHarness,
	serverHarness,
} from "../conformance/conformance-setup.js";

declare module "vitest/browser" {
	interface BrowserCommands {
		renderOnServer: (component: string, props: Record<string, unknown>) => Promise<string>;
		renderPartOnServer: (harness: ServerHarness) => Promise<string>;
	}
}

/** The tag, id and `data-*` attributes of one element. */
export type ElementSnapshot = { tag: string; id: string; data: Record<string, string> };

/**
 * The server HTML of the component at `url` (`new URL("./fixtures/x.svelte", import.meta.url)`),
 * rendered with `props`, which cross to the server as JSON.
 */
export function renderOnServer(url: URL, props: Record<string, unknown> = {}): Promise<string> {
	return commands.renderOnServer(decodeURIComponent(url.pathname), props);
}

/**
 * The server HTML of a part's conformance harness for `setup`, rendered with the props the
 * conformance suite hydrates.
 */
export function renderPartOnServer<State>(setup: ConformanceSetup<State>): Promise<string> {
	const harness = serverHarness(setup);
	const path = (from: { url: string; name: string }) => ({
		url: decodeURIComponent(new URL(from.url).pathname),
		name: from.name,
	});
	return commands.renderPartOnServer({
		...harness,
		part: path(harness.part),
		wrapper: harness.wrapper && path(harness.wrapper),
	});
}

/** A container on the page holding `html`, as the browser parsed it. Removed when the test ends. */
export function serverHtmlOnPage(html: string): HTMLElement {
	const container = document.body.appendChild(document.createElement("div"));
	container.innerHTML = html;
	onTestFinished(() => container.remove());
	return container;
}

/**
 * Hydrates `Component` with `props` over the server HTML in `container`, and throws if hydration
 * logs a warning or an error about it. The component is unmounted when the test ends.
 */
export function hydrateOnPage<Props extends Record<string, unknown>>(
	container: HTMLElement,
	Component: Component<Props>,
	props: Props,
): void {
	const app = hydrateChecked(container, Component, props);
	onTestFinished(() => void unmount(app));
}

/**
 * Puts the server HTML on the page, hydrates `Component` over it, then unmounts it and removes
 * the container; returns every element's snapshot before and after hydration. `inspect` runs with
 * the hydrated container first.
 */
export function ssrHydration<Props extends Record<string, unknown>>(
	Component: Component<Props>,
	props: Props,
	html: string,
	inspect?: (container: HTMLElement) => void,
): { before: ElementSnapshot[]; after: ElementSnapshot[] } {
	const container = document.body.appendChild(document.createElement("div"));
	container.innerHTML = html;
	let app: ReturnType<typeof hydrate> | undefined;
	try {
		const before = snapshotElements(container);
		let after: ElementSnapshot[] = [];
		app = hydrateChecked(container, Component, props, () => {
			after = snapshotElements(container);
			inspect?.(container);
		});
		return { before, after };
	} finally {
		if (app) {
			void unmount(app);
		}
		container.remove();
	}
}

/**
 * Hydrates and applies the first update, runs `hydrated`, then throws if a `console.warn` or
 * `console.error` mentioned hydration meanwhile: the one mismatch check of this file. On a throw,
 * the component is unmounted.
 */
function hydrateChecked<Props extends Record<string, unknown>>(
	container: HTMLElement,
	Component: Component<Props>,
	props: Props,
	hydrated?: () => void,
): ReturnType<typeof hydrate> {
	const warn = vi.spyOn(console, "warn");
	const error = vi.spyOn(console, "error");
	try {
		const app = hydrate(Component, { target: container, props });
		try {
			flushSync();
			hydrated?.();
			const messages = [...warn.mock.calls, ...error.mock.calls]
				.map((args) => args.map(String).join(" "))
				.filter((message) => message.includes("hydration"));
			if (messages.length > 0) {
				throw new Error(`Hydration logged:\n${messages.join("\n")}`);
			}
		} catch (failure) {
			void unmount(app);
			throw failure;
		}
		return app;
	} finally {
		warn.mockRestore();
		error.mockRestore();
	}
}

/** Every element in `container`, in document order: its tag, id and `data-*` attributes. */
function snapshotElements(container: Element): ElementSnapshot[] {
	return Array.from(container.querySelectorAll("*"), (element) => ({
		tag: element.tagName.toLowerCase(),
		id: element.id,
		data: Object.fromEntries(
			Array.from(element.attributes)
				.filter((attribute) => attribute.name.startsWith("data-"))
				.map((attribute) => [attribute.name, attribute.value]),
		),
	}));
}
