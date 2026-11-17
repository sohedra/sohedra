// How modules resolve on each thread, and Svelte server code the first frame never needs.

import { createRequire } from "node:module";
import path from "node:path";

import type { ModifyBundlerChainUtils, Rspack, RspackChain } from "@rsbuild/core";

import { SERVER_ASYNC_HOOKS_IMPORT, SERVER_CRYPTO_FILE } from "../../svelte/build/index.ts";
import { PACKAGE_NAME } from "../../wire/index.ts";
import { escapeRegExp } from "../string-literal.ts";
import { LAYERS, PACKAGE_ROOT, RUNTIME_FILES } from "./layers.ts";

const NAME = `${PACKAGE_NAME}:resolve`;

/** A request for `names` or for a path in one of them. */
export const requestsOf = (names: readonly string[]): RegExp =>
	new RegExp(`^(?:${names.map(escapeRegExp).join("|")})(?:/|$)`);

/**
 * Resolves `svelte` and the `singleCopy` packages from the app's folder, and this package's own
 * requests from this package's folder. A linked or nested library never brings a second copy of
 * Svelte (two copies break context and reactivity) or of the binding (two renderers reject each
 * other's snippets), and an app that gets the binding through a library, with no dependency of
 * its own, still builds. Resolving the request from a folder, not aliasing it to a path, keeps
 * each package's `exports` conditions working.
 */
class SingleCopyPlugin {
	readonly rootPath: string;
	readonly fromApp: RegExp;
	readonly fromBinding: RegExp;

	constructor(rootPath: string, singleCopy: readonly string[]) {
		this.rootPath = rootPath;
		this.fromApp = requestsOf(["svelte", ...singleCopy]);
		this.fromBinding = requestsOf([PACKAGE_NAME]);
	}

	apply(compiler: Rspack.Compiler): void {
		compiler.hooks.normalModuleFactory.tap(NAME, (factory) => {
			factory.hooks.beforeResolve.tap(NAME, (data) => {
				if (this.fromBinding.test(data.request)) data.context = PACKAGE_ROOT;
				else if (this.fromApp.test(data.request)) data.context = this.rootPath;
			});
		});
	}
}

/** Where the app's own Svelte and its `esm-env` are, and the binding's one copy of each. */
export function configureSingleCopies(
	chain: RspackChain,
	options: { rootPath: string; singleCopy: readonly string[] },
): void {
	const { rootPath, singleCopy } = options;
	const svelteRoot = path.dirname(
		createRequire(path.join(rootPath, "package.json")).resolve("svelte/package.json"),
	);
	// `esm-env` (`BROWSER`: false on the main thread, Svelte's server) comes from Svelte's own
	// dependency, so apps need not install it. Only the bare import: esm-env's own `esm-env/browser`
	// must reach its exports map, which picks each thread's version.
	chain.resolve.alias.set(
		"esm-env$",
		createRequire(path.join(svelteRoot, "package.json")).resolve("esm-env"),
	);
	chain.plugin(NAME).use(SingleCopyPlugin, [rootPath, singleCopy]);
}

/**
 * `import 'background-only'` keeps a module off the main thread: there the module becomes a stub
 * with the same exports. The import resolves to this package's own empty module, so apps need not
 * install a package for it.
 */
export function configureBackgroundOnly(chain: RspackChain, loader: string): void {
	chain.resolve.alias.set("background-only$", RUNTIME_FILES.backgroundOnly);
	chain.module
		.rule(`${PACKAGE_NAME}:background-only`)
		.test(/\.[cm]?[jt]s$/)
		.issuerLayer(LAYERS["main-thread"])
		// Last, after whatever compiled the module to JavaScript.
		.enforce("post")
		.use("background-only")
		.loader(loader)
		.options({ marker: RUNTIME_FILES.backgroundOnly });
}

/**
 * How packages resolve on the main thread: to their server builds (Svelte's come first under
 * `worker`, before `browser`).
 */
export function mainThreadConditions(isDev: boolean): string[] {
	return ["worker", "svelte", "lynx", "import", "require", isDev ? "development" : "production"];
}

/** How packages resolve on each thread. */
export function configureResolve(chain: RspackChain, isDev: boolean): void {
	// The Lynx engine resolves with lynx/import/require/browser only. Svelte libraries publish their
	// entry under `svelte` (what svelte-package writes), older ones in a `svelte` main field that
	// points at their sources. Svelte itself decides dev or production through esm-env's conditions;
	// without one it decides at run time (keeping dev code, and warning).
	chain.resolve.conditionNames.add("svelte").add(isDev ? "development" : "production");
	chain.resolve.mainFields.prepend("svelte");
	// A rule's `resolve` is for the requests of the modules it matches: here, the modules a
	// main-thread module imports.
	chain.module
		.rule(`${PACKAGE_NAME}:main-thread-resolve`)
		.issuerLayer(LAYERS["main-thread"])
		.resolve.conditionNames.merge(mainThreadConditions(isDev));
}

/**
 * Svelte server code the first frame never runs, kept quiet and out of the bundle.
 *
 * @workaround svelte-server-imports kind=svelte-internal delete-when="Svelte's server runtime imports node:async_hooks and crypto only where it uses them"
 */
export function ignoreUnusedSvelteServerCode(
	chain: RspackChain,
	bundler: ModifyBundlerChainUtils["bundler"],
): void {
	// Only Svelte's async server rendering loads it (a dynamic import); the first frame renders
	// synchronously.
	chain
		.plugin(`${PACKAGE_NAME}:ignore-async-hooks`)
		.use(bundler.IgnorePlugin, [{ resourceRegExp: SERVER_ASYNC_HOOKS_IMPORT }]);
	// Svelte's CSP-hash helper imports `crypto` through an expression; the first frame never calls
	// it. Without this, every build warns.
	chain.module
		.rule(`${PACKAGE_NAME}:svelte-server-crypto`)
		.test(SERVER_CRYPTO_FILE)
		.parser({ exprContextCritical: false });
}
