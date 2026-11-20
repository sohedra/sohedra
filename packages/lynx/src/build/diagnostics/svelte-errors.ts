// What Svelte's compiler throws and warns, written as the build's messages: the plain sentence
// first, then the place, the code frame and Svelte's own docs link. A feature Svelte refuses under
// a custom renderer gets the build's message, which says what exists instead.

import { bannedFeature, isDiagnostic, splitLink } from "../../svelte/build/index.ts";
import type { Diagnostic } from "../../svelte/build/index.ts";
import { formatMessage } from "../../wire/index.ts";
import { buildError, placeAt } from "./messages.ts";
import type { BuildError, BuildWarning, Place, SourceText } from "./messages.ts";

/** The text a compile read, and where it came from. */
export interface SourceContext {
	/** The text the passes read, which the places of a message point into. */
	source: SourceText;
	/** Where an offset in the text Svelte compiled is in `source`. */
	locate: (offset: number) => number;
}

/** The place Svelte's error or warning is at, if it has one. */
function placeOf(diagnostic: Diagnostic, context: SourceContext): Place | undefined {
	const character = diagnostic.start?.character;
	if (character === undefined) return undefined;
	return placeAt(context.source, context.locate(character));
}

/** The build's error for a feature Svelte refuses under a custom renderer, or `undefined` for one it does not know. */
function refusedFeatureError(
	feature: string,
	place: Place | undefined,
	context: SourceContext,
	offset: number | undefined,
): BuildError | undefined {
	const details = { feature };
	switch (feature) {
		case "`bind:`": {
			// Svelte's message does not say which binding: read it at the error's place.
			const name =
				offset === undefined ? null : /^bind:(\w+)/.exec(context.source.text.slice(offset));
			return buildError({ code: "bind_directive", details: { name: name?.[1] }, place });
		}
		case "`transition:`":
			return buildError({ code: "transition_directive", details, place });
		case "`in:`":
			return buildError({ code: "in_directive", details, place });
		case "`out:`":
			return buildError({ code: "out_directive", details, place });
		case "`animate:`":
			return buildError({ code: "animate_directive", details, place });
		case "`on:`":
			return buildError({ code: "on_directive", details, place });
		case "`@html`":
			return buildError({ code: "html_tag", details, place });
		case "`<svelte:window>`":
			return buildError({ code: "svelte_window", details, place });
		case "`<svelte:document>`":
			return buildError({ code: "svelte_document", details, place });
		case "`<svelte:body>`":
			return buildError({ code: "svelte_body", details, place });
		case "`<svelte:head>`":
			return buildError({ code: "svelte_head", details, place });
		case "`css: 'injected'`":
			return buildError({ code: "css_injected", details: {}, place });
		default:
			return undefined;
	}
}

/**
 * A thrown Svelte compile error as the build's message, with the place and the code frame in
 * its text (Rspack prints the message only). Anything else is returned as it is.
 */
export function compileError(error: unknown, context: SourceContext): unknown {
	if (!isDiagnostic(error)) return error;
	const place = placeOf(error, context);
	const character = error.start?.character;
	const feature = bannedFeature(error);
	if (feature !== undefined) {
		const offset = character === undefined ? undefined : context.locate(character);
		const refused = refusedFeatureError(feature, place, context, offset);
		if (refused !== undefined) return refused;
	}
	const { sentence, link } = splitLink(error.message);
	error.message = formatMessage({ sentence, where: place?.where, frame: place?.frame, link });
	return error;
}

const inNodeModules = (file: string): boolean => /[\\/]node_modules[\\/]/.test(file);

/**
 * Svelte's warnings as the build's messages. Warnings in dependencies are left out: the app's
 * author cannot fix them.
 */
export function compileWarnings(warnings: Diagnostic[], context: SourceContext): BuildWarning[] {
	if (inNodeModules(context.source.file)) return [];
	return warnings.map((warning) => {
		const place = placeOf(warning, context);
		const { sentence, link } = splitLink(warning.message);
		return {
			code: warning.code,
			message: formatMessage({ sentence, where: place?.where, frame: place?.frame, link }),
		};
	});
}

/** A preprocessor's error as the build's message, which names the file. */
export function preprocessError(error: unknown, file: string): BuildError {
	const reason = error instanceof Error ? error.message : String(error);
	return buildError({
		code: "preprocess_failed",
		details: { reason },
		place: { file, where: file, frame: "" },
	});
}
