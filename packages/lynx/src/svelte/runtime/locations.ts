// Where in a component Svelte made an element, as its development build records it.

/** What Svelte's development build puts on each element it makes from a template. */
interface SvelteMeta {
	loc?: { file?: unknown; line?: unknown; column?: unknown };
}

/**
 * The `file:line:col` of the markup that made `node`, in a development build; `undefined` in a
 * production build, or for a node Svelte did not make from a component's template.
 */
export function sourceLocation(node: object): string | undefined {
	// Boundary: Svelte's development build adds this field to the renderer's own node objects.
	const meta = (node as { __svelte_meta?: SvelteMeta }).__svelte_meta;
	const loc = meta?.loc;
	if (!loc || typeof loc.file !== "string") return undefined;
	return `${loc.file}:${String(loc.line)}:${String(loc.column)}`;
}
