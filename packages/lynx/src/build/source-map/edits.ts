// Edits to a source text, with a source map if the caller wants one: how every pass of the
// compile step rewrites a component or a script, all at once, against the text as written.

import { MapBuilder, position } from "./maps.ts";
import type { SourceMap } from "./maps.ts";

/**
 * A part of the text an edit writes: generated text (mapped to the place `at` in the source) or
 * a copy of the source.
 */
export type Piece = { text: string; at: number } | { copy: [start: number, end: number] };

/** Replace `start`..`end` (equal for an insertion) with `text`, or with `pieces`. */
export interface Edit {
	start: number;
	end: number;
	text?: string;
	pieces?: Piece[];
}

/** The text of `pieces`, with copies taken from `source`. */
export function pieceText(source: string, pieces: Piece[]): string {
	return pieces
		.map((piece) => ("copy" in piece ? source.slice(...piece.copy) : piece.text))
		.join("");
}

/** The text of `pieces` as one source map into `source`, which the map calls `name`. */
export function pieceMap(options: { source: string; pieces: Piece[]; name: string }): SourceMap {
	const { source, pieces, name } = options;
	const builder = new MapBuilder();
	writePieces(source, pieces, builder);
	return builder.toMap(name, source);
}

function writePieces(source: string, pieces: Piece[], builder: MapBuilder): string {
	let code = "";
	for (const piece of pieces) {
		if ("copy" in piece) {
			const text = source.slice(...piece.copy);
			builder.copy(text, position(source, piece.copy[0]));
			code += text;
		} else {
			builder.generated(piece.text, position(source, piece.at));
			code += piece.text;
		}
	}
	return code;
}

/** What `applyEdits` makes of a source. */
interface Edited {
	code: string;
	/** The map from `code` to the source, which it calls `name`. */
	map: (name: string) => SourceMap;
	/** Where an offset in `code` came from in the source. */
	locate: (offset: number) => number;
}

/**
 * `source` with `edits` applied, in source order. The edits must not overlap, and edits that
 * start in the same place are applied in the order given.
 */
export function applyEdits(source: string, edits: Edit[]): Edited {
	const builder = new MapBuilder();
	let code = "";
	// Per edit: where it starts in the result, how long it is, and what it replaced.
	const places: { at: number; length: number; end: number; start: number }[] = [];
	const add = (pieces: Piece[]): void => {
		code += writePieces(source, pieces, builder);
	};
	let cursor = 0;
	for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
		add([{ copy: [cursor, edit.start] }]);
		const at = code.length;
		add(edit.pieces ?? [{ text: edit.text ?? "", at: edit.start }]);
		places.push({ at, length: code.length - at, start: edit.start, end: edit.end });
		cursor = edit.end;
	}
	add([{ copy: [cursor, source.length] }]);
	return {
		code,
		map: (name) => builder.toMap(name, source),
		locate: (offset) => {
			let shift = 0;
			for (const place of places) {
				if (offset < place.at) break;
				if (offset < place.at + place.length) return place.start;
				shift = place.at + place.length - place.end;
			}
			return offset - shift;
		},
	};
}
