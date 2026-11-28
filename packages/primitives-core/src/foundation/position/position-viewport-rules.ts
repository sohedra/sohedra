// A popup Viewport's decisions, as pure functions: when its content is created anew, which way
// it moves when the popup goes from one trigger to another, and which edges the popup grows from.

import type { Side } from "./position-types.js";

/** What the content key last settled on: the trigger and payload it was created for. */
export interface ContentKeyState {
	readonly triggerId: string | null;
	readonly payload: unknown;
	/** The trigger id changed but its payload didn't (yet): it is expected an update later. */
	readonly pendingPayload: boolean;
	readonly key: number;
}

/**
 * The content key for the current trigger id and payload, from the committed one: a new key on
 * every new trigger id, and once more when that trigger's payload arrives an update after it.
 * Returns `committed` itself while neither changed.
 */
export function nextContentKey(
	committed: ContentKeyState,
	triggerId: string | null,
	payload: unknown,
): ContentKeyState {
	const payloadChanged = payload !== committed.payload;
	if (triggerId !== committed.triggerId) {
		return { triggerId, payload, pendingPayload: !payloadChanged, key: committed.key + 1 };
	}
	if (!payloadChanged) {
		return committed;
	}
	if (committed.pendingPayload) {
		return { triggerId, payload, pendingPayload: false, key: committed.key + 1 };
	}
	return { ...committed, payload };
}

/** The distance between the centres of the trigger the popup left and the one it went to. */
export interface TriggerOffset {
	readonly horizontal: number;
	readonly vertical: number;
}

const DIRECTION_TOLERANCE = 5;

/**
 * The direction the content moves in when the active trigger changes, as the tokens of
 * `data-activation-direction`: `right` or `left`, then `down` or `up`. An axis within five pixels
 * gives no token.
 */
export function getActivationDirection(offset: TriggerOffset | null): string | undefined {
	if (!offset) {
		return undefined;
	}
	const token = (value: number, positive: string, negative: string) =>
		value > DIRECTION_TOLERANCE ? positive : value < -DIRECTION_TOLERANCE ? negative : "";
	return `${token(offset.horizontal, "right", "left")} ${token(offset.vertical, "down", "up")}`;
}

/**
 * The edges a resizing popup is pinned to, so it grows away from its anchor: its bottom on the
 * top side, its right on the left side (the logical start side included). `null` on the other
 * sides, where it already grows away.
 */
export function pinnedEdges(
	side: Side,
	rtl: boolean,
): { vertical: "top" | "bottom"; horizontal: "left" | "right" } | null {
	const isTop = side === "top";
	const isLeft = side === "left" || side === (rtl ? "inline-end" : "inline-start");
	if (!isTop && !isLeft) {
		return null;
	}
	return { vertical: isTop ? "bottom" : "top", horizontal: isLeft ? "right" : "left" };
}
