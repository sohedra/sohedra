// Puts the binding's calls into Lynx's dev client (`@lynx-js/webpack-dev-transport`'s client), in a
// development build (../../background/dev-client.ts says what each does):
//
//   function reloadPage() {             function reloadPage() {
//                                  →        if (__sohedraReloadNeedsDevTool()) return;
//   function logBuildErrors(errors) {   function logBuildErrors(errors) {
//                                  →        __sohedraReportBuildErrors(errors);
//
// The rule that runs this matches those two files only. Where Lynx changed a function, the file is
// left as it is and the build warns.

import type { Rspack } from "@rsbuild/core";

import { buildWarning } from "../diagnostics/messages.ts";
import { stringLiteral } from "../string-literal.ts";

/** The dev client's files this loader changes. */
export const DEV_CLIENT_FILE: RegExp =
	/[\\/]webpack-dev-transport[\\/]lib[\\/]client[\\/](?:reloadApp|logBuildErrors)\.js$/;

/** The dev client's own module, which imports the two. */
const DEV_CLIENT_INDEX = /[\\/]webpack-dev-transport[\\/]lib[\\/]client[\\/]index\.js(?:\?|$)/;

/** The files the loader changes, by their name in the dev client's folder. */
const PATCHED = ["reloadApp.js", "logBuildErrors.js"];

/**
 * The dev client's files the loader never saw in a build that has the dev client: Lynx renamed or
 * removed them, or the app's build brings a dev client older than these files. Nothing of a build
 * without the dev client (a production build) is missing.
 */
export function missingDevClientFiles(resources: readonly string[]): string[] {
	if (!resources.some((resource) => DEV_CLIENT_INDEX.test(resource))) return [];
	return PATCHED.filter(
		(name) =>
			!resources.some((resource) => DEV_CLIENT_FILE.test(resource) && resource.endsWith(name)),
	).map((name) => `@lynx-js/webpack-dev-transport/lib/client/${name}`);
}

/** Each function, the call put first in it, and the binding's function it calls. */
const PATCHES = [
	{
		anchor: "function reloadPage() {",
		call: "if (__sohedraReloadNeedsDevTool()) return;",
		name: "reloadNeedsDevTool",
		local: "__sohedraReloadNeedsDevTool",
	},
	{
		anchor: "function logBuildErrors(errors) {",
		call: "__sohedraReportBuildErrors(errors);",
		name: "reportBuildErrors",
		local: "__sohedraReportBuildErrors",
	},
];

/** What the loader is given: the binding's module the calls are imported from. */
export interface DevClientLoaderOptions {
	devClient: string;
}

/** `source` with the binding's calls put in, or `undefined` for a file it has no patch for. */
function patchDevClient(
	source: string,
	file: string,
	devClient: string,
): { code: string } | { missing: string } {
	const name = file.endsWith("reloadApp.js") ? "reloadPage" : "logBuildErrors";
	const patch = PATCHES.find((each) => each.anchor.includes(`${name}(`))!;
	const at = source.indexOf(patch.anchor);
	if (at === -1 || source.indexOf(patch.anchor, at + 1) !== -1) return { missing: patch.anchor };
	const end = at + patch.anchor.length;
	const code = `${source.slice(0, end)}\n    ${patch.call}${source.slice(end)}`;
	const imported = `import { ${patch.name} as ${patch.local} } from ${stringLiteral(devClient)};\n`;
	return { code: imported + code };
}

export default function devClientLoader(
	this: Rspack.LoaderContext<DevClientLoaderOptions>,
	source: string,
): string {
	this.cacheable(true);
	const result = patchDevClient(source, this.resourcePath, this.getOptions().devClient);
	if ("code" in result) return result.code;
	const { message } = buildWarning({
		code: "dev_client_moved",
		details: { file: this.resourcePath, anchor: result.missing },
	});
	this.emitWarning(Object.assign(new Error(message), { stack: "" }));
	return source;
}
