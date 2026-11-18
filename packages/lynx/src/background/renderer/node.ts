// A node of the renderer's tree. The tree lives on the background, beside Svelte: Svelte walks it
// synchronously (first child, next sibling, parent), so the walk never reaches Lynx. Only
// elements, and text inside a text element, become Lynx elements; fragments and comments exist
// only here, as Svelte's anchors.
//
// Plain fields, not `#private` ones: Lynx's JavaScript engine is ES2019, where private fields
// compile to a lookup per access.

/** What a node is, in Svelte's renderer's words. */
export type NodeKind = "fragment" | "element" | "text" | "comment";

/** What an `<input>` or a `<textarea>` holds, once it has a `value`. */
export interface InputState {
	/** What the native input holds, as far as the background knows. */
	current: string;
	/** Whether the keyboard is composing (IME input). */
	composing: boolean;
	/** From an `input` event until its update has run: the change came from typing. */
	typing: boolean;
}

/** One node of the tree. */
export class TreeNode {
	readonly kind: NodeKind;
	/** The id of its Lynx element; 0 while it has none. */
	lynxId: number = 0;
	tag: string | null = null;
	/** A text's or a comment's text. */
	data: string | null = null;
	attrs: Map<string, unknown> | null = null;
	parent: TreeNode | null = null;
	// Children as a linked list, as in the DOM: an insert, a removal and a sibling stay O(1) however
	// many siblings there are.
	first: TreeNode | null = null;
	last: TreeNode | null = null;
	prev: TreeNode | null = null;
	next: TreeNode | null = null;
	/** The handler id of each event, by `type:name`. */
	events: Map<string, number> | null = null;
	input: InputState | null = null;
	/**
	 * The list cell its Lynx element was made in: its own id for a cell, the cell's for what is
	 * inside one, 0 for the page.
	 */
	cell: number = 0;

	constructor(kind: NodeKind) {
		this.kind = kind;
	}
}
