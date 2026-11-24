// A test run's first-frame copy of a component (`./Card.svelte?first-frame`): a module of the main
// thread's layer that imports the component, so it and all it imports compile as a build's first
// frame does, and that records how to draw it with the main thread's `mountPage`, as the page's
// entry does there.
//
//   import drawCard from "./Card.svelte?first-frame";
//   drawCard({ title: "Hello" }); // before the engine renders the page

import path from "node:path";

import type { Rspack } from "@rsbuild/core";

import { FIRST_FRAME_COPY_KEY } from "../../wire/index.ts";
import { stringLiteral } from "../string-literal.ts";

/** What the copy's loader is told. */
interface FirstFrameCopyOptions {
	/** The main thread's `@sohedra/lynx`, which exports `mountPage`. */
	entry: string;
}

/** The copy's source: `component` is the component's request, `entry` the main thread's root. */
export function firstFrameCopySource(component: string, entry: string): string {
	return [
		`import Component from ${stringLiteral(component)};`,
		`import { mountPage } from ${stringLiteral(entry)};`,
		"export default function drawFirstFrame(props = {}, context) {",
		"\tmountPage(Component, { props, context });",
		"}",
		"",
	].join("\n");
}

/**
 * What a test run's component appends to hang its copy on itself, `copy` being the copy's request:
 * it imports itself, its default export whatever the compiler named it.
 */
export function hangFirstFrameCopy(self: string, copy: string): string {
	return (
		`\nimport __sohedraSelf from ${stringLiteral(self)};` +
		`\nimport __sohedraFirstFrame from ${stringLiteral(copy)};` +
		`\n__sohedraSelf[Symbol.for(${stringLiteral(FIRST_FRAME_COPY_KEY)})] = __sohedraFirstFrame;\n`
	);
}

export default function firstFrameCopyLoader(
	this: Rspack.LoaderContext<FirstFrameCopyOptions>,
): string {
	return firstFrameCopySource(`./${path.basename(this.resourcePath)}`, this.getOptions().entry);
}
