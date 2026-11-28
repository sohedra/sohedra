// Server-side browser commands for `tests/setup-browser.ts` and the server renders of
// `tests/kit/kit-server.ts`. They run in Node, with Playwright's page for the test file's session.
import type { Component } from "svelte";
import type { render } from "svelte/server";
import type { BrowserCommand, TestProject } from "vitest/node";

import type { ServerExport, ServerHarness } from "./conformance/conformance-setup.js";

const TESTER_FRAME = "vitest-iframe";

/**
 * Resolves once Playwright's first `vitest-iframe` frame is this file's tester: Vitest replaces the
 * previous file's iframe and Playwright runs commands on the first frame of that name, so a
 * command on the old one, not yet gone on a loaded machine, fails with "Frame was detached".
 */
const awaitTesterFrame: BrowserCommand<[]> = async ({ page, testPath }) => {
	const deadline = Date.now() + 10_000;
	for (;;) {
		const frame = page.frame(TESTER_FRAME);
		if (frame && !frame.isDetached() && testerPath(frame.url()) === testPath) {
			return;
		}
		if (Date.now() > deadline) {
			throw new Error(`The tester frame for ${testPath} never became Playwright's first frame.`);
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

/**
 * Moves the real pointer off the page. It stays where the last real action left it, across tests
 * and files of a page, and content rendered under it gets real `mouseover`, `mouseenter` and
 * `mousemove` events (a toast viewport would pause, a menu's input take focus).
 */
const parkPointer: BrowserCommand<[]> = async ({ page }) => {
	await page.mouse.move(-1, -1);
};

/**
 * Renders the component at `component` (a path from the package root, `/tests/…/x.svelte`) with
 * Svelte's server renderer and returns its HTML. The component and `svelte/server` load through
 * the project's Vite server, compiled for the server.
 */
const renderOnServer: BrowserCommand<[component: string, props: Record<string, unknown>]> = async (
	{ project },
	component,
	props,
) => {
	const { render } = await loadServerRenderer(project);
	// Boundary: Vite's module loader types a module as a record of `any`.
	const module = (await project.vite.ssrLoadModule(component)) as { default: Component };
	return render(module.default, { props }).body;
};

/**
 * Renders a part's conformance harness on the server and returns its HTML: the part and wrapper
 * `harness` names (module path from the package root, dotted export), with the props the hydration
 * test hydrates with, in its `on` state.
 */
const renderPartOnServer: BrowserCommand<[harness: ServerHarness]> = async (
	{ project },
	harness,
) => {
	const { render } = await loadServerRenderer(project);
	const load = async ({ url, name }: ServerExport) => {
		// Boundary: Vite's module loader types a module as a record of `any`.
		const module = (await project.vite.ssrLoadModule(url)) as Record<string, unknown>;
		const found = name
			.split(".")
			.reduce<unknown>(
				(value, key) => (value as Record<string, unknown> | undefined)?.[key],
				module,
			);
		if (found === undefined) {
			throw new Error(`${url} has no export ${name}.`);
		}
		// Boundary: an export a setup names as a component.
		return found as Component<Record<string, unknown>>;
	};
	// Boundary: as above.
	const component = (await project.vite.ssrLoadModule(
		"/tests/conformance/fixtures/conformance-harness.svelte",
	)) as { default: Component };
	const props = {
		...harness.props,
		part: await load(harness.part),
		wrapper: harness.wrapper && (await load(harness.wrapper)),
		isOn: () => harness.stateful,
	};
	return render(component.default, { props }).body;
};

function loadServerRenderer(project: TestProject): Promise<{ render: typeof render }> {
	// Boundary: Vite's module loader types a module as a record of `any`.
	return project.vite.ssrLoadModule("svelte/server") as Promise<{ render: typeof render }>;
}

function testerPath(url: string): string | null {
	try {
		return new URL(url).searchParams.get("iframeId");
	} catch {
		return null;
	}
}

export const browserCommands = {
	awaitTesterFrame,
	parkPointer,
	renderOnServer,
	renderPartOnServer,
};
