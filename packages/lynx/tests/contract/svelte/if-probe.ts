// Svelte's client runtime with its own `$.if` watched, which a compiled fixture imports in place of
// `svelte/internal/client`: each run of a block's function, the numbers it renders its branches
// with, and the node right before the anchor once a branch has rendered.

// @ts-expect-error -- Svelte publishes no types for its internal modules.
import { if as svelteIf } from "svelte/internal/client";

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/client";

interface ProbedNode {
	name?: string;
	parent: { children: ProbedNode[] } | null;
}

type Render = (branch: unknown, key?: number | false) => void;

/** One run of a block's function: the numbers given, and the tag before the anchor after each. */
export interface Run {
	keys: (number | false | undefined)[];
	before: (string | undefined)[];
}

/** Every run since the fixture loaded, in order. */
export const runs: Run[] = [];

function probedIf(anchor: ProbedNode, fn: (render: Render) => void, elseif?: boolean): void {
	// Boundary: Svelte's function, typed by what it does.
	(svelteIf as (anchor: unknown, fn: (render: Render) => void, elseif?: boolean) => void)(
		anchor,
		(render) => {
			const run: Run = { keys: [], before: [] };
			runs.push(run);
			fn((branch, key) => {
				run.keys.push(key);
				render(branch, key);
				const siblings = anchor.parent?.children ?? [];
				run.before.push(siblings[siblings.indexOf(anchor) - 1]?.name);
			});
		},
		elseif,
	);
}

export { probedIf as if };
