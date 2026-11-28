// The safe polygon, as pure functions: the area a pointer may cross on its way from a trigger to
// its popup without the popup closing. Points and rectangles in, an answer out. No state, no
// Svelte and no platform.

import type { PhysicalSide } from "../position/index.js";

const POLYGON_BUFFER = 0.5;
const CURSOR_SPEED_THRESHOLD = 0.1;
const CURSOR_SPEED_THRESHOLD_SQUARED = CURSOR_SPEED_THRESHOLD * CURSOR_SPEED_THRESHOLD;

/** A measured box, as `getBoundingClientRect()` returns it. */
export interface Box {
	readonly left: number;
	readonly right: number;
	readonly top: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

function hasIntersectingEdge(
	pointX: number,
	pointY: number,
	xi: number,
	yi: number,
	xj: number,
	yj: number,
) {
	return yi >= pointY !== yj >= pointY && pointX <= ((xj - xi) * (pointY - yi)) / (yj - yi) + xi;
}

/** Whether a point lies inside the quadrilateral (x1,y1)…(x4,y4) (even-odd rule). */
export function isPointInQuadrilateral(
	pointX: number,
	pointY: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number,
	x4: number,
	y4: number,
): boolean {
	let inside = false;
	if (hasIntersectingEdge(pointX, pointY, x1, y1, x2, y2)) {
		inside = !inside;
	}
	if (hasIntersectingEdge(pointX, pointY, x2, y2, x3, y3)) {
		inside = !inside;
	}
	if (hasIntersectingEdge(pointX, pointY, x3, y3, x4, y4)) {
		inside = !inside;
	}
	if (hasIntersectingEdge(pointX, pointY, x4, y4, x1, y1)) {
		inside = !inside;
	}
	return inside;
}

/** Whether a point lies inside `box`, edges included. */
function isInsideBox(pointX: number, pointY: number, box: Box): boolean {
	return pointX >= box.left && pointX <= box.right && pointY >= box.top && pointY <= box.bottom;
}

function isInsideAxisAlignedRect(
	pointX: number,
	pointY: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
) {
	return (
		pointX >= Math.min(x1, x2) &&
		pointX <= Math.max(x1, x2) &&
		pointY >= Math.min(y1, y2) &&
		pointY <= Math.max(y1, y2)
	);
}

/**
 * Whether the pointer (`clientX`, `clientY`) is in the rectangular trough between the anchor
 * and the popup on `side`, which always keeps the popup open.
 */
function isInsideTrough(
	side: PhysicalSide,
	clientX: number,
	clientY: number,
	anchorRect: Box,
	rect: Box,
): boolean {
	const isPopupWider = rect.width > anchorRect.width;
	const isPopupTaller = rect.height > anchorRect.height;
	const left = (isPopupWider ? anchorRect : rect).left;
	const right = (isPopupWider ? anchorRect : rect).right;
	const top = (isPopupTaller ? anchorRect : rect).top;
	const bottom = (isPopupTaller ? anchorRect : rect).bottom;
	switch (side) {
		case "top":
			return isInsideAxisAlignedRect(
				clientX,
				clientY,
				left,
				anchorRect.top + 1,
				right,
				rect.bottom - 1,
			);
		case "bottom":
			return isInsideAxisAlignedRect(
				clientX,
				clientY,
				left,
				rect.top + 1,
				right,
				anchorRect.bottom - 1,
			);
		case "left":
			return isInsideAxisAlignedRect(
				clientX,
				clientY,
				rect.right - 1,
				bottom,
				anchorRect.left + 1,
				top,
			);
		case "right":
			return isInsideAxisAlignedRect(
				clientX,
				clientY,
				anchorRect.right - 1,
				bottom,
				rect.left + 1,
				top,
			);
	}
}

/**
 * Whether the pointer (`clientX`, `clientY`) is in the safe triangle from where it left the
 * anchor (`x`, `y`) to the popup's near edge on `side`.
 */
function isInsideSafeTriangle(
	side: PhysicalSide,
	x: number,
	y: number,
	clientX: number,
	clientY: number,
	anchorRect: Box,
	rect: Box,
): boolean {
	const cursorLeaveFromRight = x > rect.right - rect.width / 2;
	const cursorLeaveFromBottom = y > rect.bottom - rect.height / 2;
	const isPopupWider = rect.width > anchorRect.width;
	const isPopupTaller = rect.height > anchorRect.height;

	if (side === "top" || side === "bottom") {
		const cursorXOffset = isPopupWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
		const pointOneX = isPopupWider
			? x + cursorXOffset
			: cursorLeaveFromRight
				? x + cursorXOffset
				: x - cursorXOffset;
		const pointTwoX = isPopupWider
			? x - cursorXOffset
			: cursorLeaveFromRight
				? x + cursorXOffset
				: x - cursorXOffset;
		if (side === "top") {
			const pointY = y + POLYGON_BUFFER + 1;
			const commonYLeft = cursorLeaveFromRight
				? rect.bottom - POLYGON_BUFFER
				: isPopupWider
					? rect.bottom - POLYGON_BUFFER
					: rect.top;
			const commonYRight = cursorLeaveFromRight
				? isPopupWider
					? rect.bottom - POLYGON_BUFFER
					: rect.top
				: rect.bottom - POLYGON_BUFFER;
			return isPointInQuadrilateral(
				clientX,
				clientY,
				pointOneX,
				pointY,
				pointTwoX,
				pointY,
				rect.left,
				commonYLeft,
				rect.right,
				commonYRight,
			);
		}
		const pointY = y - POLYGON_BUFFER;
		const commonYLeft = cursorLeaveFromRight
			? rect.top + POLYGON_BUFFER
			: isPopupWider
				? rect.top + POLYGON_BUFFER
				: rect.bottom;
		const commonYRight = cursorLeaveFromRight
			? isPopupWider
				? rect.top + POLYGON_BUFFER
				: rect.bottom
			: rect.top + POLYGON_BUFFER;
		return isPointInQuadrilateral(
			clientX,
			clientY,
			pointOneX,
			pointY,
			pointTwoX,
			pointY,
			rect.left,
			commonYLeft,
			rect.right,
			commonYRight,
		);
	}

	const cursorYOffset = isPopupTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
	const pointOneY = isPopupTaller
		? y + cursorYOffset
		: cursorLeaveFromBottom
			? y + cursorYOffset
			: y - cursorYOffset;
	const pointTwoY = isPopupTaller
		? y - cursorYOffset
		: cursorLeaveFromBottom
			? y + cursorYOffset
			: y - cursorYOffset;
	if (side === "left") {
		const pointX = x + POLYGON_BUFFER + 1;
		const commonXTop = cursorLeaveFromBottom
			? rect.right - POLYGON_BUFFER
			: isPopupTaller
				? rect.right - POLYGON_BUFFER
				: rect.left;
		const commonXBottom = cursorLeaveFromBottom
			? isPopupTaller
				? rect.right - POLYGON_BUFFER
				: rect.left
			: rect.right - POLYGON_BUFFER;
		return isPointInQuadrilateral(
			clientX,
			clientY,
			commonXTop,
			rect.top,
			commonXBottom,
			rect.bottom,
			pointX,
			pointOneY,
			pointX,
			pointTwoY,
		);
	}
	const pointX = x - POLYGON_BUFFER;
	const commonXTop = cursorLeaveFromBottom
		? rect.left + POLYGON_BUFFER
		: isPopupTaller
			? rect.left + POLYGON_BUFFER
			: rect.right;
	const commonXBottom = cursorLeaveFromBottom
		? isPopupTaller
			? rect.left + POLYGON_BUFFER
			: rect.right
		: rect.left + POLYGON_BUFFER;
	return isPointInQuadrilateral(
		clientX,
		clientY,
		pointX,
		pointOneY,
		pointX,
		pointTwoY,
		commonXTop,
		rect.top,
		commonXBottom,
		rect.bottom,
	);
}

/** One pointer move, measured by the platform. */
export interface SafePolygonInput {
	readonly clientX: number;
	readonly clientY: number;
	readonly isLeave: boolean;
	readonly isOverPopup: boolean;
	readonly isOverAnchor: boolean;
	/** Whether a leave's related target is inside the popup. */
	readonly leavingIntoPopup: boolean;
	readonly hasOpenChild: boolean;
	/** Read lazily: only when the decision needs geometry. */
	readonly measure: () => { anchor: Box; popup: Box };
	readonly now: number;
}

/**
 * What to do after a pointer move: keep the popup open, close it, or close it unless another
 * move arrives within 40ms (the cursor is in the safe triangle but hasn't landed yet).
 */
export type SafePolygonDecision = "stay" | "close" | "close-soon";

/** Where one hover-out stands between two pointer moves. */
export interface SafePolygonTrack {
	/** The popup's physical side of the trigger. */
	readonly side: PhysicalSide;
	/** Where the pointer left the trigger. */
	readonly x: number;
	readonly y: number;
	/** Whether the pointer has reached the popup (or come back onto the trigger). */
	readonly hasLanded: boolean;
	/** The last move the speed check measured, if any. */
	readonly lastX: number | null;
	readonly lastY: number | null;
	readonly lastTime: number;
}

/** The track of a hover-out that starts now: the pointer left the trigger at `x`, `y`. */
export function startSafePolygon(
	side: PhysicalSide,
	x: number,
	y: number,
	now: number,
): SafePolygonTrack {
	return { side, x, y, hasLanded: false, lastX: null, lastY: null, lastTime: now };
}

/**
 * The decision for one pointer move, and the track for the next one. The speed check measures
 * a move only when the decision reaches it, so the track remembers the last move it measured.
 */
export function decideSafePolygon(
	track: SafePolygonTrack,
	input: SafePolygonInput,
): { readonly decision: SafePolygonDecision; readonly track: SafePolygonTrack } {
	const { clientX, clientY, isLeave } = input;
	const { side, x, y } = track;
	let { hasLanded, lastX, lastY, lastTime } = track;
	const decided = (decision: SafePolygonDecision) => ({
		decision,
		track: { side, x, y, hasLanded, lastX, lastY, lastTime },
	});

	if (input.isOverPopup) {
		hasLanded = true;
		if (!isLeave) {
			return decided("stay");
		}
	}
	if (input.isOverAnchor) {
		hasLanded = false;
		if (!isLeave) {
			hasLanded = true;
			return decided("stay");
		}
	}
	// An overlapping popup must not get stuck in an open-close loop.
	if (isLeave && input.leavingIntoPopup) {
		return decided("stay");
	}
	// Any open nested child keeps it open.
	if (input.hasOpenChild) {
		return decided("stay");
	}

	const { anchor: anchorRect, popup: rect } = input.measure();

	// Leaving from the opposite side: the buffer would otherwise keep it open.
	if (
		(side === "top" && y >= anchorRect.bottom - 1) ||
		(side === "bottom" && y <= anchorRect.top + 1) ||
		(side === "left" && x >= anchorRect.right - 1) ||
		(side === "right" && x <= anchorRect.left + 1)
	) {
		return decided("close");
	}

	// The rectangular trough between the two elements always stays open.
	if (isInsideTrough(side, clientX, clientY, anchorRect, rect)) {
		return decided("stay");
	}

	if (hasLanded && !isInsideBox(clientX, clientY, anchorRect)) {
		return decided("close");
	}

	if (!isLeave) {
		// Slower than the threshold since the last measured move: the pointer isn't travelling.
		const elapsed = input.now - lastTime;
		const measured = lastX !== null && lastY !== null && elapsed !== 0;
		const deltaX = clientX - (lastX ?? clientX);
		const deltaY = clientY - (lastY ?? clientY);
		const isMovingSlowly =
			measured &&
			deltaX * deltaX + deltaY * deltaY < elapsed * elapsed * CURSOR_SPEED_THRESHOLD_SQUARED;
		lastX = clientX;
		lastY = clientY;
		lastTime = input.now;
		if (isMovingSlowly) {
			return decided("close");
		}
	}

	if (!isInsideSafeTriangle(side, x, y, clientX, clientY, anchorRect, rect)) {
		return decided("close");
	}
	return decided(hasLanded ? "stay" : "close-soon");
}
