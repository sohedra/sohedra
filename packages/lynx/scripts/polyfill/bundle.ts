// Bundles the npm packages the polyfill folder uses into src/polyfill/vendor/, one plain ES module
// per entry of entries/, so an app runs the code its fills were tested with and installs none of
// them. Rspack with SWC, as an app's own build: the same lowering, to what Lynx's engines parse;
// then the regular expressions' Unicode property escapes (`\p{…}`), which SWC keeps and PrimJS
// refuses, written out as the code points they stand for. Each file starts with the license of every package bundled into it. The output is committed and
// copied into lib/ at build (copy.ts); a test bundles again and compares, so a package update fails
// until this runs: `pnpm -F @sohedra/lynx vendor`.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rspack } from "@rsbuild/core";
import type { Rspack } from "@rsbuild/core";
import { tokenizer } from "acorn";
import rewritePattern from "regexpu-core";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Where the entries are, one file per vendored module. */
export const ENTRIES: string = path.join(PACKAGE_ROOT, "scripts/polyfill/entries");

/** The modules provided in place of a global a package reads as it loads (provide/). */
const PROVIDED: string = path.join(PACKAGE_ROOT, "scripts/polyfill/provide");

/** Where the vendored modules are written, next to the fills that import them. */
export const VENDOR: string = path.join(PACKAGE_ROOT, "src/polyfill/vendor");

/** The language level the vendored modules are lowered to: what PrimJS parses. */
const TARGET = "es2019";

/** The names of the entries, which are the vendored modules' names. */
export function vendorNames(): string[] {
	return fs
		.readdirSync(ENTRIES)
		.filter((file) => file.endsWith(".js"))
		.map((file) => file.slice(0, -".js".length))
		.sort();
}

/** A bundled module: its text, and the npm packages in it. */
export interface Vendored {
	code: string;
	packages: string[];
}

/** Bundles the entry `name` and returns the module's text, with its packages' licenses first. */
export async function bundleVendor(name: string): Promise<Vendored> {
	const out = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-vendor-"));
	try {
		const compiler = rspack({
			mode: "production",
			context: PACKAGE_ROOT,
			entry: { [name]: path.join(ENTRIES, `${name}.js`) },
			target: ["web", TARGET],
			devtool: false,
			output: {
				path: out,
				filename: "[name].js",
				module: true,
				chunkFormat: "module",
				library: { type: "modern-module" },
			},
			optimization: {
				minimize: false,
				concatenateModules: true,
				splitChunks: false,
				runtimeChunk: false,
				avoidEntryIife: true,
			},
			module: {
				rules: [
					{
						test: /\.[cm]?js$/,
						loader: "builtin:swc-loader",
						options: {
							jsc: { target: TARGET, parser: { syntax: "ecmascript" } },
							isModule: "unknown",
						},
						type: "javascript/auto",
					},
				],
			},
			// What a package reads by name as it loads, which a thread lacks until the fills run.
			plugins: [new rspack.ProvidePlugin({ atob: [path.join(PROVIDED, "atob.js"), "atob"] })],
			performance: false,
			infrastructureLogging: { level: "error" },
		});
		const stats = await new Promise<Rspack.Stats>((resolve, reject) => {
			compiler.run((error, result) => {
				compiler.close(() => {});
				if (error) reject(error);
				else if (!result) reject(new Error(`Bundling ${name} gave no result.`));
				else resolve(result);
			});
		});
		const info = stats.toJson({ all: false, errors: true, modules: true, nestedModules: true });
		if (stats.hasErrors())
			throw new Error(`Bundling ${name} failed:\n${info.errors?.map((e) => e.message).join("\n")}`);
		const folders = packageFolders(
			(info.modules ?? []).flatMap((module) => [
				module.nameForCondition ?? "",
				...(module.modules ?? []).map((inner) => inner.nameForCondition ?? ""),
			]),
		);
		const packages = [...folders.keys()];
		const code = lowerPropertyEscapes(fs.readFileSync(path.join(out, `${name}.js`), "utf8"));
		const banners = packages.map((pkg) => licenseBanner(pkg, folders.get(pkg)!));
		return { code: banners.join("") + code, packages };
	} finally {
		fs.rmSync(out, { recursive: true, force: true });
	}
}

/** The npm packages the given module paths are in, sorted by name, each with its folder. */
function packageFolders(files: string[]): Map<string, string> {
	const folders = new Map<string, string>();
	for (const file of files) {
		const at = file.lastIndexOf("node_modules");
		if (at === -1) continue;
		const match = /^node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(file.slice(at));
		if (match) folders.set(match[1]!.replace(/\\/g, "/"), file.slice(0, at + match[0].length - 1));
	}
	return new Map([...folders].sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * `code` with each regular expression literal that has a Unicode property escape (`\p{…}`,
 * `\P{…}`) written with the code points it stands for, keeping its flags. PrimJS refuses the
 * escapes, as a literal and through `new RegExp`; a pattern built at run time keeps them.
 */
export function lowerPropertyEscapes(code: string): string {
	const edits: { start: number; end: number; text: string }[] = [];
	for (const token of tokenizer(code, { ecmaVersion: "latest", sourceType: "module" })) {
		if (token.type.label !== "regexp") continue;
		// Boundary: acorn gives a regular expression token's value as its pattern and flags.
		const { pattern, flags } = (token as unknown as { value: { pattern: string; flags: string } })
			.value;
		if (!/\\[pP]\{/.test(pattern)) continue;
		const lowered = rewritePattern(pattern, flags, { unicodePropertyEscapes: "transform" });
		edits.push({ start: token.start, end: token.end, text: `/${lowered}/${flags}` });
	}
	let result = code;
	for (const { start, end, text } of edits.reverse())
		result = result.slice(0, start) + text + result.slice(end);
	return result;
}

/** A comment with a package's name, version and license text, kept by every minifier (`/*!`). */
function licenseBanner(name: string, folder: string): string {
	// Boundary: JSON has no type; a package's manifest has these fields.
	const manifest = JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8")) as {
		version: string;
		license: string;
	};
	const file = fs.readdirSync(folder).find((entry) => /^licen[cs]e([.-]|$)/i.test(entry));
	if (!file) throw new Error(`${name} has no license file to keep in its vendored module.`);
	const text = fs.readFileSync(path.join(folder, file), "utf8").trim().replace(/\*\//g, "* /");
	const lines = [`${name} ${manifest.version} (${manifest.license})`, "", ...text.split(/\r?\n/)];
	return `/*!\n${lines.map((line) => ` * ${line}`.trimEnd()).join("\n")}\n */\n`;
}

/** Bundles every entry into src/polyfill/vendor/. */
async function writeAll(): Promise<void> {
	for (const name of vendorNames()) {
		const { code } = await bundleVendor(name);
		fs.writeFileSync(path.join(VENDOR, `${name}.js`), code);
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await writeAll();
