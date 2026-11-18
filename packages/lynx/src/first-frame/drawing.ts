// Whether the page's components are drawing the first frame now: their top-level code runs then,
// as on Svelte's server, and a call that would act on the page waits for the background's.

let depth = 0;

/** Whether the first frame is being drawn. */
export function drawing(): boolean {
	return depth > 0;
}

/** Runs `draw`, which draws the first frame. */
export function whileDrawing<T>(draw: () => T): T {
	depth++;
	try {
		return draw();
	} finally {
		depth--;
	}
}
