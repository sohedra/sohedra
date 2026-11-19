// The template plugin of the Lynx build engine must be a version this package works with.
//
// The engine and this package each run a template plugin on the compilation. Two copies of one
// version keep their hooks on the compilation under one global symbol, so they work together; a
// copy outside the range this package declares may not. The engine that builds is the one the app
// resolves (rspeedy brings its own), so that is the copy read, not this package's.

import { createRequire } from "node:module";
import path from "node:path";

import { buildError } from "../diagnostics/messages.ts";
import { PACKAGE_ROOT } from "./layers.ts";

const PLUGIN = "@lynx-js/template-webpack-plugin";
const ENGINE = "@lynx-js/rsbuild-plugin";
const RSPEEDY = "@lynx-js/rspeedy";

/** The `package.json` of `name`, as `require` resolves it from `from`; `undefined` when there is none. */
function manifestOf(name: string, from: string): string | undefined {
	try {
		return createRequire(from).resolve(`${name}/package.json`);
	} catch {
		return undefined;
	}
}

/** The `version` field of a `package.json`. */
function versionIn(manifest: string): string | undefined {
	// Boundary: a package.json read at run time.
	const { version } = createRequire(import.meta.url)(manifest) as { version?: string };
	return version;
}

/** The version of the template plugin this package installs. */
export function ownTemplateVersion(): string {
	const manifest = manifestOf(PLUGIN, import.meta.url);
	return (manifest === undefined ? undefined : versionIn(manifest)) ?? "unknown";
}

/** The range of template plugin versions this package declares, from its `package.json`. */
export function ownTemplateRange(): string {
	// Boundary: this package's package.json, read at run time.
	const manifest = createRequire(import.meta.url)(path.join(PACKAGE_ROOT, "package.json")) as {
		dependencies: Record<string, string>;
	};
	return manifest.dependencies[PLUGIN] ?? "unknown";
}

/** `major.minor.patch` as numbers, or `undefined` for a version with a prerelease or any other shape. */
function release(version: string): [number, number, number] | undefined {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Whether `version` is in the caret range `range` (`^0.16.8`): at or above it, and below the next
 * version that changes the leftmost number that is not zero. Only released versions are in a range.
 */
export function satisfiesRange(version: string, range: string): boolean {
	const found = release(version);
	const floor = release(range.replace(/^\^/, ""));
	if (found === undefined || floor === undefined) return false;
	const [major, minor, patch] = floor;
	const [foundMajor, foundMinor, foundPatch] = found;
	if (foundMajor !== major) return false;
	if (major === 0) return foundMinor === minor && foundPatch >= patch;
	return foundMinor > minor || (foundMinor === minor && foundPatch >= patch);
}

/**
 * The version of the template plugin installed for the engine whose plugin is in `folder`: the one
 * the engine itself resolves. `undefined` when there is none.
 */
export function templateVersionOf(folder: string): string | undefined {
	const manifest = manifestOf(PLUGIN, path.join(folder, "package.json"));
	return manifest === undefined ? undefined : versionIn(manifest);
}

/**
 * The folder of the engine's plugin that builds the app: this package's own when it registered the
 * engine; otherwise the one the app resolves, or the one its rspeedy brings. `undefined` when the
 * app has neither.
 */
export function engineFolder(options: { registered: boolean; root: string }): string | undefined {
	const { registered, root } = options;
	const from = registered ? import.meta.url : path.join(root, "package.json");
	const direct = manifestOf(ENGINE, from);
	if (direct !== undefined) return path.dirname(direct);
	if (registered) return undefined;
	const rspeedy = manifestOf(RSPEEDY, from);
	const brought = rspeedy === undefined ? undefined : manifestOf(ENGINE, rspeedy);
	return brought === undefined ? undefined : path.dirname(brought);
}

/**
 * Throws the build's message when the engine's template plugin is outside the range this package
 * declares. A patch or minor release inside the range is fine.
 */
export function checkTemplatePlugin(versions: {
	engine: string;
	own: string;
	range: string;
}): void {
	if (satisfiesRange(versions.engine, versions.range)) return;
	throw buildError({ code: "template_plugin_versions", details: versions });
}
