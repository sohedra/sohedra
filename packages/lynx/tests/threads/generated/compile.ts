// Compiles a generated page for both threads with the build's own compile step
// (`compileComponent`, which the component loader runs), as a build would: the background's copy
// through the custom renderer, the main thread's through Svelte's server renderer. What the loader
// adds around it is not needed here: the pages have no styles, no TypeScript for SWC to strip, and
// no hot reload. A page compiled for production still runs on the test run's runtime, which is the
// development one.

import path from "node:path";

import { compileComponent } from "../../../src/build/index.ts";
import type { Thread } from "../../../src/wire/index.ts";
import { INTERNALS, RENDERER } from "./evaluate.ts";
import type { CompiledPage } from "./evaluate.ts";

/** This package's folder: Svelte's compiler is resolved from it. */
const ROOT = path.resolve(import.meta.dirname, "../../..");

/** Where a generated page's components are said to be, for Svelte's file names and messages. */
const FOLDER = path.join(ROOT, "tests/threads/generated/pages");

/** A generated page's components as source, children before their parents, the root last. */
export type PageSources = readonly (readonly [file: string, source: string])[];

/** A page compiled for both threads. */
export interface CompiledBoth {
	readonly background: CompiledPage;
	readonly mainThread: CompiledPage;
}

async function compileFor(
	sources: PageSources,
	options: { thread: Thread; development: boolean; ownPasses: boolean },
): Promise<CompiledPage> {
	const { thread, development, ownPasses } = options;
	const modules: [string, string][] = [];
	for (const [file, source] of sources) {
		const compiled = await compileComponent(source, {
			filename: path.join(FOLDER, file),
			thread,
			root: ROOT,
			development,
			sourceMap: false,
			renderer: RENDERER,
			serverInternals: INTERNALS,
			clientInternals: ownPasses ? INTERNALS : undefined,
		});
		// Without its own passes, the background's copy still runs on the binding's runtime.
		modules.push([
			file,
			ownPasses
				? compiled.code
				: compiled.code.replaceAll("'svelte/internal/client'", JSON.stringify(INTERNALS)),
		]);
	}
	return { modules };
}

/**
 * Compiles `sources` for both threads, for development unless `production`. `ownPasses: false`
 * compiles the background's copy without the passes that call the binding's runtime, as Svelte
 * writes it: for a canary of Svelte's own behavior.
 */
export async function compilePage(
	sources: PageSources,
	options: { production?: boolean; ownPasses?: false } = {},
): Promise<CompiledBoth> {
	const development = options.production !== true;
	const ownPasses = options.ownPasses !== false;
	return {
		background: await compileFor(sources, { thread: "background", development, ownPasses }),
		mainThread: await compileFor(sources, { thread: "main-thread", development, ownPasses: true }),
	};
}
