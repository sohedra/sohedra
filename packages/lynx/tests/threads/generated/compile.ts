// Compiles a generated page for both threads with the build's own compile step
// (`compileComponent`, which the component loader runs), as a build would: the background's copy
// through the custom renderer, the main thread's through Svelte's server renderer. What the loader
// adds around it is not needed here: the pages have no styles, no TypeScript for SWC to strip, and
// no hot reload.

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

async function compileFor(sources: PageSources, thread: Thread): Promise<CompiledPage> {
	const modules: [string, string][] = [];
	for (const [file, source] of sources) {
		const compiled = await compileComponent(source, {
			filename: path.join(FOLDER, file),
			thread,
			root: ROOT,
			development: true,
			sourceMap: false,
			renderer: RENDERER,
			serverInternals: INTERNALS,
			clientInternals: INTERNALS,
		});
		modules.push([file, compiled.code]);
	}
	return { modules };
}

/** Compiles `sources` for both threads. */
export async function compilePage(sources: PageSources): Promise<CompiledBoth> {
	return {
		background: await compileFor(sources, "background"),
		mainThread: await compileFor(sources, "main-thread"),
	};
}
