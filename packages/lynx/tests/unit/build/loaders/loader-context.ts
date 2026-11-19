// A loader's `this`, for tests that call a loader directly: what the bundler gives it, and what
// it gave back.

import path from "node:path";

import { APP_ROOT } from "../app.ts";

/** What a loader gave back. */
export interface LoaderResult {
	error: Error | null | undefined;
	code: string | undefined;
	map: unknown;
	/** Whether the loader had answered by the time it returned. */
	sync: boolean;
	warnings: Error[];
	dependencies: string[];
}

/** What a test says about the run. */
export interface LoaderRun {
	options?: object;
	/** A path under the test app's `src` folder. */
	file?: string;
	mode?: "development" | "production";
	sourceMap?: boolean;
	/** The build the loader runs in: loaders of one build share a store. */
	compiler?: object;
	/** A query on the resource, as `?css=abc`. */
	query?: string;
}

// Boundary: a loader's `this` is the bundler's context; a test gives only what the loaders read.
type Loader = (this: never, source: string, map?: never) => unknown;

/** Call `loader` on `source` with a fake loader context, and wait for its answer. */
export function runLoader(
	loader: Loader,
	source: string,
	run: LoaderRun = {},
	map?: unknown,
): Promise<LoaderResult> {
	return new Promise((resolve) => {
		const warnings: Error[] = [];
		const dependencies: string[] = [];
		let returned = false;
		let answered = false;
		const answer = (error: Error | null | undefined, code?: string | Buffer, outMap?: unknown) => {
			if (answered) return;
			answered = true;
			resolve({
				error,
				code: code === undefined ? undefined : String(code),
				map: outMap,
				sync: !returned,
				warnings,
				dependencies,
			});
		};
		const context = {
			_compiler: run.compiler ?? {},
			getOptions: () => run.options ?? {},
			rootContext: APP_ROOT,
			resourcePath: path.join(APP_ROOT, "src", run.file ?? "Component.svelte"),
			resourceQuery: run.query ?? "",
			mode: run.mode ?? "production",
			sourceMap: run.sourceMap ?? false,
			cacheable: () => {},
			async: () => answer,
			callback: answer,
			addDependency: (file: string) => dependencies.push(file),
			emitWarning: (warning: Error) => warnings.push(warning),
		};
		try {
			const value = (loader as (this: object, source: string, map?: unknown) => unknown).call(
				context,
				source,
				map,
			);
			if (typeof value === "string") answer(null, value);
			returned = true;
		} catch (error) {
			returned = true;
			answer(error as Error);
		}
	});
}
