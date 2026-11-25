// A generated page as the Svelte source of its components: compact, with no whitespace between
// nodes, or indented, with a line and a tab between them as people write it (which inside a
// `<text>` makes texts of its own).

import type { PageSources } from "./compile.ts";
import { IDS } from "./evaluate.ts";
import type { ComponentModel, PageModel } from "./grammar.ts";
import { THREAD_TESTS } from "./markup.ts";
import type { Deferred, ListChild, MarkupNode } from "./markup.ts";

/**
 * The rows of a long list, before the state adds a few: more than Lynx holds on a screen and the
 * screen of cells the main thread keeps past those.
 */
const ROWS = 22;

/** The most rows a long list has: `st.n0` is at most 2. */
export const LONG_ROWS: number = ROWS + 2 * 2;

/**
 * An element's opening tag. One with a main-thread tap handler, as an attribute or a spread, also
 * says with `data-one-thread` whether only one thread renders it, as `outer` does: before
 * hydration, such an element is the first frame's alone, and a call of a background function from
 * it has no answer by design (`first_frame_call_unanswered`), so no step taps it then. The mark is
 * part of the page: both threads render it the same way, and the trees compare it.
 */
function opening(tag: string, attributes: readonly string[], outer: string): string {
	const taps = attributes.some((written) => written.includes("main-thread:ontap"));
	const all = taps ? [...attributes, `data-one-thread={${outer} || undefined}`] : attributes;
	return all.length === 0 ? `<${tag}>` : `<${tag} ${all.join(" ")}>`;
}

/**
 * What every component declares for its markup's main-thread attributes: a handler that counts
 * its taps in a ref of the component, shows the count on its element and changes the page's state
 * on the background; a ref for an element; a function ref that marks its element while it is
 * bound; and gestures built from the page's state, a pan and a tap that waits for it, whose
 * callback counts in the same ref. What a main-thread function sets on an element starts with `mt-`, which the trees leave
 * out: the background never knows it.
 */
const MAIN_THREAD_SCRIPT = `const mtTaps = mainThreadRef(0);
const mtRef = mainThreadRef(null);
function mtChange() { st.n0 = (st.n0 + 1) % 3; }
function mtTap(event) {
	"main thread";
	mtTaps.current += 1;
	event.currentTarget.setAttribute("mt-taps", mtTaps.current);
	runOnBackground(mtChange)();
}
function mtAttach(element) {
	"main thread";
	element.setAttribute("mt-ref", "on");
	return () => element.setAttribute("mt-ref", "off");
}
function mtMove(event, state) {
	"main thread";
	state.active();
	mtTaps.current += 1;
	event.currentTarget.setAttribute("mt-moves", mtTaps.current);
}
const mtPan = $derived(new PanGesture({ minDistance: st.n0, onUpdate: mtMove }));
const mtWait = $derived(new TapGesture({ onEnd: mtMove, waitFor: [mtPan] }));`;

/** Whether an `{#if}` with this test has branches that only one thread renders. */
const isThreadTest = (condition: string): boolean =>
	(THREAD_TESTS as readonly string[]).includes(condition);

/**
 * Writes markup with `gap` between nodes. A component and a snippet are told, as `oneThread`,
 * whether they render where only one thread does: in a branch of a thread test here, or where
 * `outer`, the expression of the markup around, says they do.
 */
function writer(gap: string): (nodes: readonly MarkupNode[], outer: string) => string {
	/** A row's `defer`, as written. */
	const deferAttribute = (defer: Deferred): string[] =>
		defer === "plain"
			? ["defer"]
			: defer === "unmount"
				? ["defer={{ unmountRecycled: true }}"]
				: [];

	function listChild(child: ListChild, outer: string): string {
		if (child.kind === "item") {
			const item = opening(
				"list-item",
				[
					`item-key="${child.key}"`,
					...deferAttribute(child.defer),
					...(child.fullSpan ? ["full-span"] : []),
					...child.attributes,
				],
				outer,
			);
			return `${item}${markup(child.body, outer)}</list-item>`;
		}
		let each: string;
		if (child.kind === "rows") {
			const rows = `Array.from({ length: ${ROWS} + st.n0 * 2 }, (_, n) => "r" + n)`;
			const item = opening(
				"list-item",
				[
					`item-key={${child.item}}`,
					...(child.fixed ? [`recyclable={${child.item} !== "r1"}`] : []),
					...deferAttribute(child.defer),
					...child.attributes,
				],
				outer,
			);
			each = `{#each ${rows} as ${child.item} (${child.item})}${item}${markup(child.body, outer)}</list-item>{/each}`;
		} else {
			const key = child.keyed ? ` (${child.item})` : "";
			const item = opening(
				"list-item",
				[
					`item-key={"${child.prefix}-" + ${child.item}}`,
					...deferAttribute(child.defer),
					...child.attributes,
				],
				outer,
			);
			each = `{#each ${child.array} as ${child.item}${key}}${item}${markup(child.body, outer)}</list-item>{/each}`;
		}
		return child.wrapped === undefined ? each : `{#if ${child.wrapped}}${each}{/if}`;
	}

	function markupNode(node: MarkupNode, outer: string): string {
		switch (node.kind) {
			case "element":
				return node.tag === "image"
					? `${opening("image", node.attributes, outer).slice(0, -1)} />`
					: `${opening(node.tag, node.attributes, outer)}${markup(node.children, outer)}</${node.tag}>`;
			case "list": {
				const deferred = node.items.some((child) => child.defer !== undefined);
				const attributes = deferred
					? ['custom-list-name="list-container"', ...node.screen, ...node.attributes]
					: node.attributes;
				return `${opening("list", attributes, outer)}${node.items.map((child) => listChild(child, outer)).join(gap)}</list>`;
			}
			case "text":
				return node.source;
			case "if": {
				const inside = isThreadTest(node.condition) ? "true" : outer;
				const otherwise = node.otherwise ? `{:else}${markup(node.otherwise, inside)}` : "";
				return `{#if ${node.condition}}${markup(node.consequent, inside)}${otherwise}{/if}`;
			}
			case "each": {
				const key = node.keyed ? ` (${node.item})` : "";
				const otherwise = node.otherwise ? `{:else}${markup(node.otherwise, outer)}` : "";
				return `{#each ${node.array} as ${node.item}${key}}${markup(node.body, outer)}${otherwise}{/each}`;
			}
			case "key":
				return `{#key ${node.expression}}${markup(node.body, outer)}{/key}`;
			case "dynamic":
				return `${opening("svelte:element", ["this={st.t0}", ...node.attributes], outer)}${markup(node.children, outer)}</svelte:element>`;
			case "component": {
				const css = node.cssVariable ? ' --x="red"' : "";
				return `<${node.name} {st} label={${node.label}} oneThread={${outer}}${css} />`;
			}
			case "render":
				return `{@render ${node.snippet}(${node.argument}, ${outer})}`;
		}
	}

	function markup(nodes: readonly MarkupNode[], outer: string): string {
		return nodes.map((node) => markupNode(node, outer)).join(gap);
	}

	return markup;
}

/** One component's source. */
export function componentSource(
	component: ComponentModel,
	options: { isRoot: boolean; indented: boolean },
): string {
	const markup = writer(options.indented ? "\n\t" : "");
	const imports = [
		'import { background, mainThread } from "@sohedra/lynx/environment";',
		'import { mainThreadRef, runOnBackground } from "@sohedra/lynx";',
		'import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";',
	];
	if (component.uid) imports.push(`import { recordId } from "${IDS}";`);
	for (const name of new Set(usedComponents(component)))
		imports.push(`import ${name} from "./${name}.svelte";`);
	const script = [
		...imports,
		options.isRoot
			? "let { data, handles } = $props();\nconst st = $state(data);\nif (handles) handles.st = st;"
			: "let { st, label, oneThread } = $props();",
	];
	if (options.isRoot) script.push("const oneThread = false;");
	if (component.uid)
		script.push(
			`const uid = $props.id();\nrecordId(${JSON.stringify(component.name)}, uid, oneThread);`,
		);
	// The flags are used only where a page has `{#if background}` or its kin: kept either way.
	script.push("void background, mainThread;");
	script.push(MAIN_THREAD_SCRIPT);
	const snippets = component.snippets
		.map((snippet) => `{#snippet ${snippet.name}(p, t)}${markup(snippet.body, "t")}{/snippet}`)
		.join("");
	const body = markup(component.body, "oneThread");
	return `<script>\n${script.join("\n")}\n</script>\n\n${snippets}${body}\n`;
}

function* namesIn(nodes: readonly MarkupNode[]): Generator<string> {
	for (const node of nodes) {
		switch (node.kind) {
			case "component":
				yield node.name;
				break;
			case "element":
			case "dynamic":
				yield* namesIn(node.children);
				break;
			case "list":
				for (const child of node.items) yield* namesIn(child.body);
				break;
			case "if":
				yield* namesIn(node.consequent);
				if (node.otherwise) yield* namesIn(node.otherwise);
				break;
			case "each":
				yield* namesIn(node.body);
				if (node.otherwise) yield* namesIn(node.otherwise);
				break;
			case "key":
				yield* namesIn(node.body);
				break;
			default:
				break;
		}
	}
}

function usedComponents(component: ComponentModel): string[] {
	return [
		...namesIn(component.body),
		...component.snippets.flatMap((snippet) => [...namesIn(snippet.body)]),
	];
}

/** The page's components as source, each after the children it uses, the root last. */
export function pageSources(page: PageModel): PageSources {
	const root = page.components.at(-1)!;
	const { indented } = page;
	// A child uses only children after it: from the last, each comes after those it uses.
	const children = page.components.slice(0, -1).reverse();
	return [
		...children.map(
			(child) =>
				[`${child.name}.svelte`, componentSource(child, { isRoot: false, indented })] as const,
		),
		[`${root.name}.svelte`, componentSource(root, { isRoot: true, indented })] as const,
	];
}

/** The page's sources as one text, for a failure's message. */
export function describeSources(sources: PageSources): string {
	return sources.map(([file, source]) => `--- ${file}\n${source}`).join("");
}
