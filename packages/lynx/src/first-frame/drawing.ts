// Whether the page's components are drawing the first frame now: their top-level code runs then,
// as on Svelte's server, and a call that would act on the page waits for the background's. And the
// data the frame is drawn from, which `initData` gives them.

let depth = 0;
let drawnFrom: Record<string, unknown> = {};

/** Whether the first frame is being drawn. */
export function drawing(): boolean {
	return depth > 0;
}

/** The page's data the first frame is drawn from, or was last drawn from. */
export function drawingData(): Record<string, unknown> {
	return drawnFrom;
}

/** Runs `draw`, which draws the first frame from the page's data `initData`. */
export function whileDrawing<T>(initData: Record<string, unknown>, draw: () => T): T {
	drawnFrom = initData;
	depth++;
	try {
		return draw();
	} finally {
		depth--;
	}
}
