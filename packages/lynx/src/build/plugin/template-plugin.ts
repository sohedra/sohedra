// The template plugin of the Lynx build engine and the one this package depends on must be the
// same version: the engine's hooks and this package's both run on the compilation, and the plugin's
// options and hooks change between versions.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { buildError } from "../diagnostics/messages.ts";

const PACKAGE = "@lynx-js/template-webpack-plugin";

/**
 * The version of the template plugin installed for `engine` (the folder of `@lynx-js/rsbuild-plugin`):
 * the nearest `node_modules` above its real folder that has one, as a package manager lays them
 * out. `undefined` when there is none.
 */
export function engineTemplateVersion(engine: string): string | undefined {
	let folder = fs.realpathSync(engine);
	for (;;) {
		const manifest = path.join(folder, "node_modules", PACKAGE, "package.json");
		if (fs.existsSync(manifest)) return versionIn(manifest);
		const parent = path.dirname(folder);
		if (parent === folder) return undefined;
		folder = parent;
	}
}

/** The version of the template plugin this package depends on. */
export function ownTemplateVersion(): string {
	return versionIn(createRequire(import.meta.url).resolve(`${PACKAGE}/package.json`)) ?? "unknown";
}

function versionIn(manifest: string): string | undefined {
	// Boundary: a package.json read at run time.
	const { version } = createRequire(import.meta.url)(manifest) as { version?: string };
	return version;
}

/**
 * Throws the build's message when the engine's template plugin is another version than this
 * package's. Equal versions are fine even as two copies: both copies keep their hooks on the
 * compilation under one global symbol.
 */
export function checkTemplatePlugin(versions: { engine: string; own: string }): void {
	if (versions.engine === versions.own) return;
	throw buildError({ code: "template_plugin_versions", details: versions });
}
