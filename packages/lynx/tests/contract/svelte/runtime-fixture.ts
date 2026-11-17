// Components compiled for the custom renderer and mounted by Svelte's own client runtime, loaded by
// Node from a folder inside the package, so that the imports of the compiled code resolve.

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
}

/** What a test gets back from `mountComponent`. */
export interface Mounted {
	target: TreeNode;
	app: object;
	log: string[];
	unmount(): Promise<void>;
}

const folder = path.join(PACKAGE_ROOT, "node_modules", ".contract-fixtures");
let count = 0;

/** The renderer module, as Node loads it: the instance compiled components import. */
export async function treeRenderer(): Promise<TreeRenderer> {
	// Boundary: the module is loaded by Node, so its type is declared here.
	return (await importNative(
		path.join(import.meta.dirname, "tree-renderer.ts"),
	)) as unknown as TreeRenderer;
}

/** Svelte's client `mount` and `unmount`, from the same files compiled components import. */
export async function svelteClient(): Promise<Client> {
	// Boundary: Svelte's modules are loaded by Node, so their type is declared here.
	return (await importSvelte("src/index-client.js")) as unknown as Client;
}

/** Compiles `markup` for the renderer module, mounts it on a new root, and clears the log. */
export async function mountComponent(markup: string): Promise<Mounted> {
	const renderer = await treeRenderer();
	const client = await svelteClient();
	const { js } = compile(markup, {
		...clientOptions({}, pathToFileURL(path.join(import.meta.dirname, "tree-renderer.ts")).href),
		filename: `Fixture${count}.svelte`,
	});
	fs.mkdirSync(folder, { recursive: true });
	const file = path.join(folder, `fixture-${count++}.mjs`);
	fs.writeFileSync(file, js.code);
	const component = (await importNative(file))["default"];
	const target = renderer.createRoot();
	const app = client.mount(component, { target, renderer: renderer.default });
	renderer.log.length = 0;
	return { target, app, log: renderer.log, unmount: () => client.unmount(app) };
}

/** Removes the compiled components the tests wrote. */
export function removeFixtures(): void {
	fs.rmSync(folder, { recursive: true, force: true });
}
