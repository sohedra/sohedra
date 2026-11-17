// A test run's first-frame copy of a component (`./Card.svelte?first-frame`): a module of the main
// thread's layer that imports the component, so it and all it imports compile as a build's first
// frame does, and that records how to draw it, as the page's entry does on the main thread.
//
//   import drawCard from "./Card.svelte?first-frame";
//   drawCard({ title: "Hello" }); // before the engine renders the page

import path from "node:path";

import type { Rspack } from "@rsbuild/core";

import { stringLiteral } from "../string-literal.ts";

/** What the copy's loader is told. */
export interface FirstFrameCopyOptions {
	/** The main thread's `startPage`. */
	startPage: string;
}

export default function firstFrameCopyLoader(
	this: Rspack.LoaderContext<FirstFrameCopyOptions>,
): string {
	const { startPage } = this.getOptions();
	const component = `./${path.basename(this.resourcePath)}`;
	return [
		`import Component from ${stringLiteral(component)};`,
		`import { startPage } from ${stringLiteral(startPage)};`,
		"export default function drawFirstFrame(props = {}) {",
		"\tstartPage(Component, { props: () => props });",
		"}",
		"",
	].join("\n");
}
