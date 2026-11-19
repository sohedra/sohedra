// The binding's part of Lynx's dev client, in a development build only: the build puts these calls
// into `@lynx-js/webpack-dev-transport`'s client (build/loaders/dev-client.ts), which runs on the
// background and is in no production build.
//
// - A build error reaches LogBox: the dev client logs it to the console only.
// - A change that needs the page to load again says so when DevTool, through which the dev client
//   loads it, is off: the dev client's call then does nothing, and says nothing.
// - After Svelte threw while it mounted, flushed or ran effects, a hot update that lands loads the
//   page again: a component that threw stays broken after a save that fixes it, since Svelte swaps
//   the component and mounts nothing again.

import { backgroundError } from "./catalogue.ts";
import { crashedSinceStart } from "./errors.ts";
import { background } from "./globals.ts";
import { warnOnce } from "./report.ts";

/** How many of the build's errors the report carries, as the dev client logs them. */
const SHOWN = 5;
// The dev server's text keeps the colors it uses in the terminal, which Lynx shows as escapes.
// oxlint-disable-next-line no-control-regex -- the escape is what is matched
const COLORS = /\u001B\[[0-9;]*m/g;

/** The build's errors as the dev server sends them: a list, or an object with their text. */
function errorTexts(errors: unknown): string[] {
	if (Array.isArray(errors)) return errors.map(String);
	const text = (errors as { text?: unknown } | null | undefined)?.text;
	return Array.isArray(text) ? text.map(String) : [];
}

/**
 * Reports the build's errors into Lynx, so LogBox shows them as the terminal does: up to five, and
 * how many more there are.
 *
 * @workaround dev-client-build-errors kind=lynx-gap delete-when="Lynx's dev client reports build errors into LogBox itself"
 */
export function reportBuildErrors(errors: unknown): void {
	const texts = errorTexts(errors).map((text) => text.replace(COLORS, "").trim());
	const shown = texts.slice(0, SHOWN);
	if (texts.length > SHOWN) shown.push(`And ${texts.length - SHOWN} more: the terminal shows all.`);
	try {
		background.lynx.reportError(
			backgroundError({ code: "build_failed", details: { where: shown.join("\n\n") } }),
		);
	} catch {
		// Reporting must never throw.
	}
}

/**
 * Whether `module` is DevTool's, able to load the page again from the dev server. Its
 * `isDevToolEnabled` answers a boolean on Android and a number on iOS (a native `BOOL` reaches
 * JavaScript as `0` or `1`), so any falsy answer is off. A module that cannot say is taken as on.
 */
function canReload(module: Record<string, unknown> | undefined): boolean {
	if (typeof module?.["invokeCdp"] !== "function") return false;
	const enabled = module["isDevToolEnabled"];
	if (typeof enabled !== "function") return true;
	try {
		return Boolean(enabled.call(module));
	} catch {
		return true;
	}
}

/**
 * Called first when the dev client loads the page again: answers whether DevTool cannot, after
 * saying so in LogBox, once. The dev client then skips its own call. Where DevTool's module is
 * there but DevTool is off, the dev client's call does nothing and says nothing: LynxDevToolSetModule's
 * invokeCdp returns when the view has no inspector. `lynx.reload` is no way around it: it starts the
 * page again from the bundle the host loaded, not from the dev server, so the change would not show.
 *
 * @workaround dev-client-reload-devtool-off kind=lynx-gap delete-when="Lynx's dev client says when DevTool cannot load the page again"
 */
export function reloadNeedsDevTool(): boolean {
	const modules = background.NativeModules;
	// Both spellings, as the dev client looks for both.
	if (canReload(modules?.["LynxDevToolSetModule"]) || canReload(modules?.["LynxDevtoolSetModule"]))
		return false;
	warnOnce("reload_needs_devtool", () =>
		backgroundError({ code: "reload_needs_devtool", details: {} }),
	);
	return true;
}

/** What the bundler's hot module API gives this module. */
export interface HotUpdates {
	addStatusHandler(handler: (status: string) => void): void;
}

/**
 * Loads the page again when a hot update lands after Svelte threw on it while it mounted, flushed
 * or ran effects: the update's modules are in place then, and the page starts from them. What the
 * app reports, a handler's own throw and the binding's own reports do not count, so the page keeps
 * its state. Two of Svelte's throws are not counted either: an `{#await}` branch's, which Svelte
 * runs in the promise's own reaction, where only Lynx sees the rejection, and an effect's inside
 * the app's own `flushSync()`, which leaves the handler as the handler's throw. A hot update is
 * applied in the status `apply`, and lands when the status turns `idle` after it.
 */
export function reloadAfterCrash(hot: HotUpdates | undefined): void {
	let last = "idle";
	hot?.addStatusHandler((status) => {
		const landed = last === "apply" && status === "idle";
		last = status;
		if (!landed || !crashedSinceStart()) return;
		try {
			background.lynx.reload?.({}, () => {});
		} catch {
			// The page stays as it is; the next save tries again.
		}
	});
}

// Boundary: the bundler gives each module its hot API here, in a development build.
reloadAfterCrash((import.meta as ImportMeta & { webpackHot?: HotUpdates }).webpackHot);
