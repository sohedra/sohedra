// The reads of globals that wait on a fill, by module, until the build knows which globals the app
// fills (plugin/missing-fills.ts). Each build's store hangs on its compiler, where the plugin puts it
// and the loaders find it, so two builds in one process never read each other's, and a copy of this
// module the loaders load apart from the plugin's finds the same store.
//
// A watch run keeps its store for its life, so a module it doesn't compile again keeps its entry. A
// build restored from a persistent cache runs no loader for a cached module: there, a module whose
// entry matters (one that waits on a fill, or installs a global) is compiled every build.

import type { PendingFill } from "./script-checks.ts";

/** What one module waits on, the fills it imports itself, and the globals it installs. */
export interface ModuleFills {
	pending: PendingFill[];
	imports: string[];
	installs: string[];
}

/** A build's store: what each module waits on, by its file. */
export interface FillsStore {
	modules: Map<string, ModuleFills>;
	/** Whether the build restores modules from a persistent cache. */
	persistent: boolean;
}

/** Where a compiler holds its build's store. */
const STORE = Symbol.for("@sohedra/lynx:fills");

/** A new store for the build of `compiler`. */
export function createFillsStore(compiler: { options?: { cache?: unknown } }): FillsStore {
	const cache = compiler.options?.cache;
	const store: FillsStore = {
		modules: new Map(),
		persistent:
			typeof cache === "object" &&
			cache !== null &&
			(cache as { type?: unknown }).type === "persistent",
	};
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
	if (fills.pending.length === 0 && fills.imports.length === 0 && fills.installs.length === 0) {
		store.modules.delete(context.resourcePath);
		return;
	}
	store.modules.set(context.resourcePath, fills);
	if (store.persistent && (fills.pending.length > 0 || fills.installs.length > 0))
		context.cacheable(false);
}

/** No reads, imports or installs: what a module the checks don't read, or one that failed, keeps. */
export const NO_FILLS: ModuleFills = { pending: [], imports: [], installs: [] };
