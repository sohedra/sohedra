// An event of Lynx's as the background receives it: plain data, with its targets named by the
// background's ids.

import type { SentEvent, SentTarget } from "../wire/index.ts";

/** Whether `value` is an object, to be read by field. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** The background's id of a Lynx element, by its unique id. */
type IdForUid = (uid: number) => number | undefined;

function target(value: unknown, idForUid: IdForUid): SentTarget | undefined {
	if (!isRecord(value)) return undefined;
	const uid = typeof value["uid"] === "number" ? value["uid"] : undefined;
	const sent: SentTarget = { element: (uid !== undefined && idForUid(uid)) || 0 };
	if (typeof value["id"] === "string") sent.id = value["id"];
	if (uid !== undefined) sent.uid = uid;
	if (isRecord(value["dataset"])) sent.dataset = value["dataset"];
	return sent;
}

/** A copy of a Lynx event as plain data, with its targets named by the background's ids. */
export function toSentEvent(event: unknown, idForUid: IdForUid): SentEvent {
	const copy: SentEvent = {};
	if (!isRecord(event)) return copy;
	for (const key of Object.keys(event)) {
		const value = event[key];
		if (key !== "target" && key !== "currentTarget" && typeof value !== "function")
			copy[key] = value;
	}
	const eventTarget = target(event["target"], idForUid);
	const current = target(event["currentTarget"], idForUid);
	if (eventTarget) copy.target = eventTarget;
	if (current) copy.currentTarget = current;
	return copy;
}
