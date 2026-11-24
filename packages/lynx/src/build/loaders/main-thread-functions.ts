// Main-thread functions in JS and TS modules: compiled in each module as written, before anything
// else compiles it, so both threads give a function the same id. Components go through the
// component's loader instead.
//
// The one loader not named for what it does: it runs on every script, so its path is part of every
// module's identifier, whose hash the source maps append to each source's name. Renaming the file
// changes every bundle.
//
// It sees every module of the build, `node_modules` included: a module without the directive
// costs a text search.

import type { Rspack } from "@rsbuild/core";

import type { Thread } from "../../wire/index.ts";
import { NO_FILLS, recordFills } from "../checks/fills-store.ts";
import { checkModule } from "../checks/module-checks.ts";
import { hasMainThreadFunction } from "../main-thread-functions/directive.ts";
import { moduleFunctions } from "../main-thread-functions/script.ts";
import { compose } from "../source-map/maps.ts";
import type { InputMap } from "../source-map/maps.ts";
import { DECLINE } from "./hot-reload.ts";
import { isSvelteSource } from "./svelte-skip.ts";

/** What the plugin tells the loader. */
interface MainThreadFunctionsLoaderOptions {
	thread: Thread;
	hot?: boolean;
	/** Check the app's own modules for what fails on Lynx (checks/module-checks.ts). */
	checks?: boolean;
}

export default function mainThreadFunctionsLoader(
	this: Rspack.LoaderContext<MainThreadFunctionsLoaderOptions>,
	source: string,
	map?: InputMap,
): void {
	// Boundary: the bundler types a source map by its own shape.
	const unchanged = (map ?? undefined) as Rspack.sources.RawSourceMap | undefined;
	if (this.getOptions().checks === true) {
		try {
			recordFills(this, checkModule({ file: this.resourcePath, text: source }, this.rootContext));
		} catch (error) {
			// Its reads from before the error are gone with it.
			recordFills(this, NO_FILLS);
			// Boundary: the bundler's callback takes an `Error`; a thrown value is any.
			this.callback(error as Error);
			return;
		}
	}
	if (!hasMainThreadFunction(source) || isSvelteSource(this.resourcePath)) {
		this.callback(null, source, unchanged);
		return;
	}
	try {
		const { thread, hot } = this.getOptions();
		const result = moduleFunctions(source, {
			filename: this.resourcePath,
			thread,
			development: this.mode === "development",
			root: this.rootContext,
			sourceMap: this.sourceMap,
		});
		// A module with main-thread functions cannot be swapped in place.
		const code = hot === true && result.ids.length > 0 ? result.code + DECLINE : result.code;
		this.callback(
			null,
			code,
			(this.sourceMap ? compose(result.map, map) : undefined) as
				| Rspack.sources.RawSourceMap
				| undefined,
		);
	} catch (error) {
		// Boundary: the bundler's callback takes an `Error`; a thrown value is any.
		this.callback(error as Error);
	}
}
