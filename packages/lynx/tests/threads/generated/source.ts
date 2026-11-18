// A generated page as the Svelte source of its components: compact, with no whitespace between
// nodes, or indented, with a line and a tab between them as people write it (which inside a
// `<text>` makes texts of its own).

import type { PageSources } from "./compile.ts";
import type { ComponentModel, PageModel } from "./grammar.ts";
import type { ListChild, MarkupNode } from "./markup.ts";

function opening(tag: string, attributes: readonly string[]): string {
	return attributes.length === 0 ? `<${tag}>` : `<${tag} ${attributes.join(" ")}>`;
}

/** Writes markup with `gap` between nodes. */
function writer(gap: string): (nodes: readonly MarkupNode[]) => string {
	function listChild(child: ListChild): string {
		if (child.kind === "item") {
			const item = opening("list-item", [`item-key="${child.key}"`, ...child.attributes]);
			return `${item}${markup(child.body)}</list-item>`;
		}
		const key = child.keyed ? ` (${child.item})` : "";
		const item = opening("list-item", [
			`item-key={"${child.prefix}-" + ${child.item}}`,
			...child.attributes,
		]);
		return `{#each ${child.array} as ${child.item}${key}}${item}${markup(child.body)}</list-item>{/each}`;
	}

	function markupNode(node: MarkupNode): string {
		switch (node.kind) {
			case "element":
				return node.tag === "image"
					? `${opening("image", node.attributes).slice(0, -1)} />`
					: `${opening(node.tag, node.attributes)}${markup(node.children)}</${node.tag}>`;
			case "list":
				return `${opening("list", node.attributes)}${node.items.map(listChild).join(gap)}</list>`;
			case "text":
				return node.source;
			case "if": {
				const otherwise = node.otherwise ? `{:else}${markup(node.otherwise)}` : "";
				return `{#if ${node.condition}}${markup(node.consequent)}${otherwise}{/if}`;
			}
			case "each": {
				const key = node.keyed ? ` (${node.item})` : "";
				const otherwise = node.otherwise ? `{:else}${markup(node.otherwise)}` : "";
				return `{#each ${node.array} as ${node.item}${key}}${markup(node.body)}${otherwise}{/each}`;
			}
			case "key":
				return `{#key ${node.expression}}${markup(node.body)}{/key}`;
			case "dynamic":
				return `${opening("svelte:element", ["this={st.t0}", ...node.attributes])}${markup(node.children)}</svelte:element>`;
			case "component": {
				const css = node.cssVariable ? ' --x="red"' : "";
				return `<${node.name} {st} label={${node.label}}${css} />`;
			}
			case "render":
				return `{@render ${node.snippet}(${node.argument})}`;
		}
	}

	function markup(nodes: readonly MarkupNode[]): string {
		return nodes.map(markupNode).join(gap);
	}

	return markup;
}

/** One component's source. */
export function componentSource(
	component: ComponentModel,
	options: { isRoot: boolean; indented: boolean },
): string {
	const markup = writer(options.indented ? "\n\t" : "");
	const imports = ['import { background } from "@sohedra/lynx/env";'];
	for (const name of new Set(usedComponents(component)))
		imports.push(`import ${name} from "./${name}.svelte";`);
	const script = [
		...imports,
		options.isRoot
			? "let { data, handles } = $props();\nconst st = $state(data);\nif (handles) handles.st = st;"
			: "let { st, label } = $props();",
	];
	if (component.uid) script.push("const uid = $props.id();");
	// `background` is used only where a page has `{#if background}`: kept either way.
	script.push("void background;");
	const snippets = component.snippets
		.map((snippet) => `{#snippet ${snippet.name}(p)}${markup(snippet.body)}{/snippet}`)
		.join("");
	return `<script>\n${script.join("\n")}\n</script>\n\n${snippets}${markup(component.body)}\n`;
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
