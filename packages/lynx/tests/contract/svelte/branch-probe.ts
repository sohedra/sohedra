// A stand-in for the runtime's `ThreadBranch`, which a compiled fixture imports by its file and the
// check loads with Node, so both reach one instance: `Marked` draws a snippet inside a synchronous
// call, and `inMark` records, as an element is drawn, whether that call is still running.

let depth = 0;

/** For each element drawn with `inMark`, whether it was drawn inside `Marked`'s call. */
export const seen: boolean[] = [];

/** Draws `render` at `target`, marked for as long as the call lasts. */
export function Marked(target: unknown, props: { render: (target: unknown) => void }): void {
	depth += 1;
	try {
		props.render(target);
	} finally {
		depth -= 1;
	}
}

/** Records whether the draw is marked; the element's name. */
export function inMark(): string {
	seen.push(depth > 0);
	return "leaf";
}

/** The names `note` was called with, in order. */
export const order: string[] = [];

/** Records `name`, and gives `value` back. */
export function note<T>(name: string, value?: T): T | undefined {
	order.push(name);
	return value;
}
