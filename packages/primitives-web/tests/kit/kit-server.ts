// Server HTML in a browser test: rendered when the test asks, by the project's Vite server, then
// put on the page and hydrated. A mismatch that hydration logs fails the test.
import { type Component, flushSync, hydrate, unmount } from "svelte";
import { onTestFinished, vi } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
	interface BrowserCommands {
		renderOnServer: (component: string, props: Record<string, unknown>) => Promise<string>;
	}
}

/**
 * The server HTML of the component at `url` (`new URL("./fixtures/x.svelte", import.meta.url)`),
 * rendered with `props`, which cross to the server as JSON.
 */
export function renderOnServer(url: URL, props: Record<string, unknown> = {}): Promise<string> {
	return commands.renderOnServer(decodeURIComponent(url.pathname), props);
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
	const warn = vi.spyOn(console, "warn");
	const error = vi.spyOn(console, "error");
	try {
		const app = hydrate(Component, { target: container, props });
		onTestFinished(() => void unmount(app));
		flushSync();
		const messages = [...warn.mock.calls, ...error.mock.calls]
			.map((args) => args.map(String).join(" "))
			.filter((message) => message.includes("hydration"));
		if (messages.length > 0) {
			throw new Error(`Hydration logged:\n${messages.join("\n")}`);
		}
	} finally {
		warn.mockRestore();
		error.mockRestore();
	}
}
