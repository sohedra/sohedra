// Rectangles for core tests that measure: `box(left, top, width, height)`, with its right and
// bottom edges.
import type { Box } from "../../src/foundation/hover/hover-safe-polygon-rules.js";

/** A measured rectangle at `left`, `top`, of `width` × `height`. */
export function box(left: number, top: number, width: number, height: number): Box {
	return { left, top, width, height, right: left + width, bottom: top + height };
}
