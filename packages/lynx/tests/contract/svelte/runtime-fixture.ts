// Components compiled for the custom renderer and mounted by Svelte's own client runtime, loaded by
// Node from a folder inside the package, so that the imports of the compiled code resolve. Each run
// of the tests writes to a folder of its own.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compile } from "svelte/compiler";

import { clientOptions } from "./compile.ts";
import { PACKAGE_ROOT, importNative, importSvelte } from "./svelte-package.ts";

interface TreeNode {
	children: TreeNode[];
	name?: string;
}

interface TreeRenderer {
	default: object;
	log: string[];
	createRoot(): TreeNode;
}

interface Client {
	mount(component: unknown, options: { target: TreeNode; renderer: object }): object;
	unmount(app: object): Promise<void>;
	flushSync(): void;
}

/** What a test gets back from `mountComponent`. */
export interface Mounted {
	target: TreeNode;
	app: object;
	log: string[];
	/** The compiled component's file. */
	file: string;
	unmount(): Promise<void>;
}

let folder: string | undefined;
let count = 0;

/** The renderer module, as Node loads it: the instance compiled components import. */
export async function treeRenderer(): Promise<TreeRenderer> {
	// Boundary: the module is loaded by Node, so its type is declared here.
	return (await importNative(
		path.join(import.meta.dirname, "tree-renderer.ts"),
	)) as unknown as TreeRenderer;
}

/** Svelte's client `mount`, `unmount` and `flushSync`, from the same files compiled components import. */
export async function svelteClient(): Promise<Client> {
	// Boundary: Svelte's modules are loaded by Node, so their type is declared here.
	return (await importSvelte("src/index-client.js")) as unknown as Client;
}

/**
 * Compiles `markup` for the renderer module into this run's folder, and loads it. `dev` compiles
 * it as a development build does.
 */
export async function loadComponent(
	markup: string,
	dev = false,
): Promise<{ component: unknown; file: string }> {
	const { js } = compile(markup, {
		...clientOptions({}, pathToFileURL(path.join(import.meta.dirname, "tree-renderer.ts")).href),
		filename: `Fixture${count}.svelte`,
		dev,
	});
	folder ??= fs.mkdtempSync(path.join(PACKAGE_ROOT, "node_modules", ".contract-fixtures-"));
	const file = path.join(folder, `fixture-${count++}.mjs`);
	fs.writeFileSync(file, js.code);
	return { component: (await importNative(file))["default"], file };
}

/**
 * Compiles `markup` for the renderer module, mounts it on a new root, and clears the log. `dev`
 * compiles it as a development build does.
 */
export async function mountComponent(markup: string, dev = false): Promise<Mounted> {
	const renderer = await treeRenderer();
	const client = await svelteClient();
	const { component, file } = await loadComponent(markup, dev);
	const target = renderer.createRoot();
	const app = client.mount(component, { target, renderer: renderer.default });
	renderer.log.length = 0;
	return { target, app, log: renderer.log, file, unmount: () => client.unmount(app) };
}

/**
 * Compiles components for Svelte's server, with `dev` or without, into this run's folder, and
 * returns the first one's module. Each source imports the others as `./<name>.svelte`.
 */
export async function serverComponents(
	sources: Record<string, string>,
	dev: boolean,
): Promise<Record<string, unknown>> {
	folder ??= fs.mkdtempSync(path.join(PACKAGE_ROOT, "node_modules", ".contract-fixtures-"));
	const run = count++;
	const fileOf = (name: string): string => path.join(folder!, `server-${run}-${name}.mjs`);
	for (const [name, source] of Object.entries(sources)) {
		const { js } = compile(source, {
			filename: `${name}.svelte`,
			generate: "server",
			runes: true,
			css: "external",
			dev,
		});
		const code = js.code.replace(
			/(['"])\.\/([A-Za-z]+)\.svelte\1/g,
			(_, quote: string, other: string) => `${quote}./server-${run}-${other}.mjs${quote}`,
		);
		fs.writeFileSync(fileOf(name), code);
	}
	return importNative(fileOf(Object.keys(sources)[0]!));
}

/** Removes the compiled components this run wrote. */
export function removeFixtures(): void {
	if (folder !== undefined) fs.rmSync(folder, { recursive: true, force: true });
	folder = undefined;
}
