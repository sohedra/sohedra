// The first frame as the app's main-thread script recorded it: a function of the page's data that
// writes the frame's markup, as the server would (src/first-frame/). Without one, or when it fails,
// there is no frame, and the background's first patch makes the page.

import { FIRST_FRAME_GLOBAL } from "../../wire/index.ts";
import { mainThreadError } from "../catalogue.ts";
import { readGlobal } from "../globals.ts";
import { isRecord } from "../sent-event.ts";
import { drawFrame } from "./draw.ts";
import type { DrawOptions, Frame } from "./draw.ts";
import { UnreadableMarkup } from "./html.ts";

/** Draws the first frame from the page's data, when the app's main-thread script recorded how. */
export function drawRecordedFrame(
	options: Omit<DrawOptions, "html"> & { data: unknown },
): Frame | undefined {
	const { data, report, ...drawing } = options;
	const markup = readGlobal(FIRST_FRAME_GLOBAL);
	if (typeof markup !== "function") return undefined;
	let html: string | null;
	try {
		// Boundary: the app's main-thread script records a function of the page's data
		// (src/first-frame/).
		html = (markup as (data: Record<string, unknown>) => string | null)(isRecord(data) ? data : {});
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		const thrown = mainThreadError({ code: "first_frame_threw", details: { reason } });
		report(Object.assign(thrown, { cause: error }));
		return undefined;
	}
	if (html === null) return undefined;
	try {
		return drawFrame({ ...drawing, html, report });
	} catch (error) {
		report(
			error instanceof UnreadableMarkup
				? mainThreadError({
						code: "first_frame_markup_unreadable",
						details: { reason: error.message, at: error.at },
					})
				: error,
		);
		return undefined;
	}
}
