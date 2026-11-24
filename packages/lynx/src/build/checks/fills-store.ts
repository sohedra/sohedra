// The reads of globals that wait on a fill, by module, until the build knows which fills the app
// imports (plugin/missing-fills.ts). Each build's store hangs on its compiler, where the plugin puts
// it and the loaders find it, so two builds in one process never read each other's, and a copy of
// this module the loaders load apart from the plugin's finds the same store. A module that waits on
// a fill is never taken from the build cache, so its reads are always here.

import type { PendingFill } from "./script-checks.ts";

/** What one module waits on, and the fills it imports itself. */
export interface ModuleFills {
	pending: PendingFill[];
	imports: string[];
}

/** A build's store: what each module waits on, by its file. */
export type FillsStore = Map<string, ModuleFills>;

/** Where a compiler holds its build's store. */
const STORE = Symbol.for("@sohedra/lynx:fills");

/** A new store for the build of `compiler`. */
export function createFillsStore(compiler: object): FillsStore {
	const store: FillsStore = new Map();
	Object.defineProperty(compiler, STORE, { value: store, configurable: true });
	return store;
}

/** What a loader knows of its module and its build. */
export interface FillsContext {
	/** Rspack's compiler. */
	_compiler?: object | undefined;
	resourcePath: string;
	cacheable(flag?: boolean): void;
}

/** Keeps what the loader's module waits on, in place of what it waited on before. */
export function recordFills(context: FillsContext, fills: ModuleFills): void {
	// Boundary: the store the plugin put on the compiler, by its symbol.
	const store = (context._compiler as { [STORE]?: FillsStore } | undefined)?.[STORE];
	if (store === undefined) return;
	if (fills.pending.length === 0 && fills.imports.length === 0) {
		store.delete(context.resourcePath);
		return;
	}
	store.set(context.resourcePath, fills);
	if (fills.pending.length > 0) context.cacheable(false);
}
