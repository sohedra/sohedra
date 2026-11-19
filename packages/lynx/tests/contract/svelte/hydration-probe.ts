// Loaded by Node itself (see importNative): the test bundler hands out copies of a module's
// exports, and `hydrating` is a live binding that only Node's own namespace keeps live.

import path from "node:path";
import { pathToFileURL } from "node:url";

interface Hydration {
	hydrating: boolean;
	set_hydrating(value: boolean): void;
}

interface RendererState {
	push_renderer(renderer: object | null): object | null;
	pop_renderer(previous: object | null): void;
}

/**
 * Whether hydration is on after each step, starting from on: while a renderer is current, after it
 * is restored, and around a call with no renderer.
 */
export async function hydratingAround(svelteRoot: string, renderer: object): Promise<boolean[]> {
	const load = (file: string): string => pathToFileURL(path.join(svelteRoot, file)).href;
	// Boundary: Svelte's internal modules have no types.
	const hydration = (await import(load("src/internal/client/dom/hydration.js"))) as Hydration;
	// Boundary: as above.
	const state = (await import(
		load("src/internal/client/custom-renderer/state.js")
	)) as RendererState;
	hydration.set_hydrating(true);
	try {
		const steps: boolean[] = [];
		const previous = state.push_renderer(renderer);
		steps.push(hydration.hydrating);
		state.pop_renderer(previous);
		steps.push(hydration.hydrating);
		state.pop_renderer(state.push_renderer(null));
		steps.push(hydration.hydrating);
		return steps;
	} finally {
		hydration.set_hydrating(false);
	}
}
