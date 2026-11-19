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

/** The last part of a path: Svelte names a component by its file's name. */
const fileName = (file: string): string => file.slice(file.lastIndexOf("/") + 1);

/**
 * The component whose markup made `node`, as its file's name (`Card.svelte`), in a development
 * build; `undefined` otherwise.
 */
export function componentOfNode(node: object): string | undefined {
	// Boundary: Svelte's development build adds this field to the renderer's own node objects.
	const file = (node as { __svelte_meta?: SvelteMeta }).__svelte_meta?.loc?.file;
	return typeof file === "string" ? fileName(file) : undefined;
}

/** A line Svelte's development build adds under the message of an error that leaves an effect. */
const COMPONENT_LINE = /^\s+in (\S+\.svelte)$/m;

/**
 * The component an error left, from the lines Svelte's development build adds to its message
 * (`\n\tin $effect\n\tin Card.svelte\n\tin App.svelte`): the innermost, `Card.svelte`. `undefined`
 * in a production build, which adds none.
 */
export function componentInMessage(message: string): string | undefined {
	const found = COMPONENT_LINE.exec(message)?.[1];
	return found === undefined ? undefined : fileName(found);
}

/**
 * The component an error came from: what the thread that threw it knew, else the innermost of
 * Svelte's lines under its message, else the component whose markup made its element.
 */
export function componentOfError(
	message: string,
	place: { node?: object | undefined; component?: string | undefined },
): string | undefined {
	return (
		place.component ??
		componentInMessage(message) ??
		(place.node ? componentOfNode(place.node) : undefined)
	);
}
