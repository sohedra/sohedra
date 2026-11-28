// Server-side browser commands for `tests/setup-browser.ts` and the server renders of
// `tests/kit/kit-server.ts`. They run in Node, with Playwright's page for the test file's session.
import type { Component } from "svelte";
import type { render } from "svelte/server";
import type { BrowserCommand, TestProject } from "vitest/node";

import type { ConformanceSetup } from "./conformance/conformance-setup.js";

const TESTER_FRAME = "vitest-iframe";

/**
 * Resolves once Playwright's first `vitest-iframe` frame is this file's tester. Vitest replaces
 * the previous file's iframe in the same page, and its Playwright provider runs every command on
 * the first frame with that name: while Playwright hasn't yet seen the old frame go (a loaded
 * machine), a command would run on it and fail with "Frame was detached".
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
 * Moves the real pointer off the page. The pointer stays where the last real pointer action left
 * it, across tests and files of the same page, and the browser sends real `mouseover`,
 * `mouseenter` and `mousemove` events to content that renders under it: a toast viewport that
 * then pauses its timers, a filterable menu's input that then takes focus.
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
 * Renders a part's conformance harness with Svelte's server renderer and returns its HTML. The
 * setup is the export `name` of the module at `module` (a path from the package root); the props
 * are the ones the conformance hydration test hydrates with.
 */
const renderPartOnServer: BrowserCommand<[module: string, name: string]> = async (
	{ project },
	module,
	name,
) => {
	const { render } = await loadServerRenderer(project);
	// Boundary: Vite's module loader types a module as a record of `any`.
	const harness = (await project.vite.ssrLoadModule(
		"/tests/conformance/conformance-harness.svelte",
	)) as { default: Component };
	// Boundary: as above.
	const { serverRenderProps } = (await project.vite.ssrLoadModule(
		"/tests/conformance/conformance-setup.ts",
	)) as { serverRenderProps: (setup: ConformanceSetup<unknown>) => Record<string, unknown> };
	// Boundary: as above.
	const setups = (await project.vite.ssrLoadModule(module)) as Record<
		string,
		ConformanceSetup<unknown> | undefined
	>;
	const setup = setups[name];
	if (setup === undefined) {
		throw new Error(`${module} has no export named ${name}.`);
	}
	return render(harness.default, { props: serverRenderProps(setup) }).body;
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
