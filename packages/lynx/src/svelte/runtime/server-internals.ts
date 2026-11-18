// What the main thread's compiled components import as Svelte's server runtime: the build points
// `svelte/internal/server` here. Svelte's own, except how an attribute's value is written, which
// the first frame's parser on the main thread reads back (`src/main-thread/frame/html.ts`):
//
//   - a string, `class` and `style` are Svelte's: `name="text"`;
//   - a number, a boolean, an object or an array is JSON in single quotes, `name='1'`, which
//     Svelte never writes: Lynx reads `span-count={1}` and `sticky-top={false}` as values, and an
//     object `data-*` or `accessibility-actions` as one;
//   - a function is the name alone, `name`, which Svelte writes for nothing: the parser binds it as
//     an event when the name is one (`bindtap`, or `ontap` from a spread), and drops it otherwise;
//   - a spread keeps its names' case, as the background's renderer does;
//   - a component given `--x` props is wrapped in a `<view>`, as on the background.
//
// And `$props.id()` inside a branch only one thread renders takes the branch's own id, as on the
// background (./thread-branches.ts).

// @ts-expect-error -- Svelte publishes no types for its internal modules; the casts below give these ones'.
import * as server from "svelte/internal/server";

import { escapeJsonText } from "../../wire/index.ts";
import { CSS_PROPS_HOLDERS } from "./css-props.ts";
import { branchId, newBranchCounts } from "./thread-branches.ts";
import type { BranchCounts } from "./thread-branches.ts";

export { ThreadBranch } from "./thread-branches.ts";

// @ts-expect-error -- Svelte publishes no types for its internal modules.
export * from "svelte/internal/server";

interface Renderer {
	push(html: string): void;
}

/** A component's renderer, as `$props.id()` is given it: `global` is one object per render. */
interface RenderingRenderer extends Renderer {
	global: object;
}

interface ServerInternals {
	attr(name: string, value: unknown, isBoolean?: boolean): string;
	attributes(
		attrs: Record<string, unknown>,
		cssHash?: string,
		classes?: Record<string, unknown>,
		styles?: Record<string, unknown>,
		flags?: number,
	): string;
	css_props(
		renderer: Renderer,
		isHtml: boolean,
		props: Record<string, string>,
		component: () => void,
		dynamic?: boolean,
	): void;
	props_id(renderer: RenderingRenderer): string;
}

// Boundary: Svelte's server runtime, typed by the interface above.
const svelte = server as ServerInternals;

/**
 * A value written as JSON in single quotes: `<`, `>` and the line separators escaped as JSON has
 * them, so no markup is in it, and `&` and `'` as HTML has them.
 */
function typed(name: string, value: unknown): string {
	const json = escapeJsonText(JSON.stringify(value) ?? "null");
	return ` ${name}='${json.replace(/&/g, "&amp;").replace(/'/g, "&#39;")}'`;
}

/** Whether this file writes the value, not Svelte. */
function ownValue(name: string, value: unknown): boolean {
	if (typeof value === "function") return true;
	if (name === "class" || name === "style") return false;
	return (
		typeof value === "number" ||
		typeof value === "boolean" ||
		(typeof value === "object" && value !== null)
	);
}

/** An attribute as the first frame writes it. */
export function attr(name: string, value: unknown, isBoolean = false): string {
	if (typeof value === "function") return ` ${name}`;
	if (ownValue(name, value)) return typed(name, value);
	return svelte.attr(name, value, isBoolean);
}

/** Svelte's flag that keeps a spread's names as written: Lynx's names are case sensitive. */
const PRESERVE_ATTRIBUTE_CASE = 2;

/**
 * A spread's attributes: the values Svelte writes are Svelte's, the others are written above, and
 * every name keeps its case, as the background's renderer keeps it.
 */
export function attributes(
	attrs: Record<string, unknown>,
	cssHash?: string,
	classes?: Record<string, unknown>,
	styles?: Record<string, unknown>,
	flags?: number,
): string {
	const own: string[] = [];
	const rest: Record<string, unknown> = {};
	for (const name of Object.keys(attrs)) {
		if (ownValue(name, attrs[name])) own.push(name);
		else rest[name] = attrs[name];
	}
	let out = svelte.attributes(
		rest,
		cssHash,
		classes,
		styles,
		(flags ?? 0) | PRESERVE_ATTRIBUTE_CASE,
	);
	for (const name of own) out += attr(name, attrs[name]);
	return out;
}

/** The opening tag of the element Svelte wraps a component given `--x` props in. */
const WRAPPER_OPEN = /^<([a-z-]+)\b/;

/**
 * A component given `--x` props, wrapped in a `<view>` with the props in its style, as on the
 * background: Svelte writes `<svelte-css-wrapper>` (or `<g>`), which Lynx has no element for.
 */
export function css_props(
	renderer: Renderer,
	isHtml: boolean,
	props: Record<string, string>,
	component: () => void,
	dynamic = false,
): void {
	// Svelte pushes the opening tag, a comment and the closing tag through the renderer it is given;
	// the component's own markup goes through the renderer it closes over.
	const wrapper: Renderer = {
		push(html) {
			const open = WRAPPER_OPEN.exec(html);
			if (open && CSS_PROPS_HOLDERS.has(open[1]!)) {
				renderer.push(`<view${html.slice(open[0].length)}`);
				return;
			}
			const close = /^<\/([a-z-]+)>$/.exec(html);
			renderer.push(close && CSS_PROPS_HOLDERS.has(close[1]!) ? "</view>" : html);
		},
	};
	svelte.css_props(wrapper, isHtml, props, component, dynamic);
}

/** The ids each render's branches that only one thread renders have given. */
const branchCounts = new WeakMap<object, BranchCounts>();

/**
 * `$props.id()`: Svelte's, `lynx-s1`, `lynx-s2`…, except in a branch only one thread renders,
 * which counts its own from the first in each render (`lynx-m1`…) and leaves Svelte's count alone.
 */
export function props_id(renderer: RenderingRenderer): string {
	let counts = branchCounts.get(renderer.global);
	if (counts === undefined) {
		counts = newBranchCounts();
		branchCounts.set(renderer.global, counts);
	}
	return branchId(counts) ?? svelte.props_id(renderer);
}
