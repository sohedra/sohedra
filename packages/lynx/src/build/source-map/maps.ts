// Source maps, so that what a component compiles to still points at what its author wrote.
//
// Rspack does not chain loader maps: each step must return a map to the original file. The few
// operations here are small enough not to need a dependency:
// - `compose(outer, inner)`: a map of a map (a rune module's compile takes no input map);
// - `MapBuilder`: a map assembled piece by piece (a component after its edits);
// - `appendMap(base, code, extra)`: a map of code followed by more text with a map of its own
//   (the registrations after a main-thread component).
//
// Tracing keeps the column offset inside a segment, so a coarse map (one segment per line) still
// lands on the right column.

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALUES = new Map(CHARS.split("").map((char, index) => [char, index]));

/** [generatedColumn, sourceIndex, line, column] (0-based) */
export type Segment = [number, number, number, number];

/** A source map as the build passes them around. */
export interface SourceMap {
	version: number;
	file?: string;
	sources: string[];
	sourcesContent?: (string | null)[];
	names?: string[];
	mappings: string;
}

/** A tool's input map: an object, a JSON string, or nothing. */
export type InputMap = SourceMap | string | null | undefined;

/** The segments of each line of `mappings`. */
export function decode(mappings: string): Segment[][] {
	const lines: Segment[][] = [];
	const state: Segment = [0, 0, 0, 0];
	for (const line of mappings.split(";")) {
		const segments: Segment[] = [];
		state[0] = 0;
		for (const text of line.split(",")) {
			if (text === "") continue;
			const fields: number[] = [];
			let value = 0;
			let shift = 0;
			for (const char of text) {
				// Boundary: a map written by another tool has only base64 digits.
				const digit = VALUES.get(char) as number;
				value += (digit & 31) << shift;
				if (digit & 32) {
					shift += 5;
				} else {
					fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
					value = 0;
					shift = 0;
				}
			}
			for (const [index, field] of fields.slice(0, 4).entries()) state[index]! += field;
			if (fields.length >= 4) segments.push([state[0], state[1], state[2], state[3]]);
		}
		lines.push(segments);
	}
	return lines;
}

/** The `mappings` of `lines`: the inverse of `decode`. */
export function encode(lines: Segment[][]): string {
	const state: Segment = [0, 0, 0, 0];
	const vlq = (number: number): string => {
		let value = number < 0 ? (-number << 1) | 1 : number << 1;
		let text = "";
		do {
			let digit = value & 31;
			value >>>= 5;
			if (value > 0) digit |= 32;
			text += CHARS[digit];
		} while (value > 0);
		return text;
	};
	return lines
		.map((segments) => {
			state[0] = 0;
			return [...segments]
				.sort((a, b) => a[0] - b[0])
				.map((segment) => {
					const text = segment.map((field, index) => vlq(field - state[index]!)).join("");
					segment.forEach((field, index) => (state[index] = field));
					return text;
				})
				.join(",");
		})
		.join(";");
}

/** A tool's map (object or JSON string), or undefined. */
function normalize(map: InputMap): SourceMap | undefined {
	if (!map) return undefined;
	// Boundary: a JSON string holds a map.
	return typeof map === "string" ? (JSON.parse(map) as SourceMap) : map;
}

/**
 * Where a position in `lines` came from: the segment at or before it on its line (the line's
 * first segment if it starts later), keeping the offset.
 */
function trace(
	lines: Segment[][],
	line: number,
	column: number,
): [number, number, number] | undefined {
	const segments = lines[line];
	if (!segments || segments.length === 0) return undefined;
	let found = segments[0]!;
	for (const segment of segments) {
		if (segment[0] > column) break;
		found = segment;
	}
	const offset = Math.max(0, column - found[0]);
	return [found[1], found[2], found[3] + offset];
}

/**
 * Compose two maps: `outer` maps the output to an intermediate file, `inner` maps that file to
 * the original. Either may be missing.
 */
export function compose(outerMap: InputMap, innerMap: InputMap): SourceMap | undefined {
	const outer = normalize(outerMap);
	const inner = normalize(innerMap);
	if (!outer || !inner) return outer ?? inner;
	const innerLines = decode(inner.mappings);
	const lines = decode(outer.mappings).map((segments) =>
		segments.flatMap(([column, , line, sourceColumn]): Segment[] => {
			const traced = trace(innerLines, line, sourceColumn);
			return traced ? [[column, ...traced]] : [];
		}),
	);
	return {
		version: 3,
		file: outer.file,
		sources: inner.sources,
		sourcesContent: inner.sourcesContent ?? [],
		names: [],
		mappings: encode(lines),
	};
}

/**
 * `base`, the code and its map, extended to the text that follows `code`: `extra` is the map of that
 * text alone, its first line continuing `code`'s last. Both maps are of the one component.
 */
export function appendMap(base: { code: string; map: SourceMap }, extra: SourceMap): SourceMap {
	const { code } = base;
	const lines = decode(base.map.mappings);
	const start = code.split("\n").length - 1;
	const column = code.length - (code.lastIndexOf("\n") + 1);
	decode(extra.mappings).forEach((segments, index) => {
		while (lines.length <= start + index) lines.push([]);
		for (const [generated, , line, sourceColumn] of segments)
			lines[start + index]!.push([
				index === 0 ? generated + column : generated,
				0,
				line,
				sourceColumn,
			]);
	});
	return { ...base.map, names: [], mappings: encode(lines) };
}

/** Builds a map for code assembled from pieces of one source file. */
export class MapBuilder {
	lines: Segment[][] = [[]];
	column = 0;

	private get current(): Segment[] {
		return this.lines[this.lines.length - 1]!;
	}

	/** Append `text`, taken unchanged from the source at (line, column). */
	copy(text: string, [line, column]: [line: number, column: number]): void {
		text.split("\n").forEach((part, index) => {
			if (index > 0) this.newLine();
			if (part.length > 0)
				this.current.push([this.column, 0, line + index, index === 0 ? column : 0]);
			this.column += part.length;
		});
	}

	/** Append generated `text`: each of its lines points at (line, column). */
	generated(text: string, [line, column]: [line: number, column: number]): void {
		text.split("\n").forEach((part, index) => {
			if (index > 0) this.newLine();
			if (part.length > 0) this.current.push([this.column, 0, line, column]);
			this.column += part.length;
		});
	}

	private newLine(): void {
		this.lines.push([]);
		this.column = 0;
	}

	/** The map of what was appended, for the source file `filename` with the text `content`. */
	toMap(filename: string, content: string): SourceMap {
		return {
			version: 3,
			file: filename,
			sources: [filename],
			sourcesContent: [content],
			names: [],
			mappings: encode(this.lines),
		};
	}
}

/** 0-based line and column of `offset` in `text`. */
export function position(text: string, offset: number): [line: number, column: number] {
	const before = text.slice(0, offset);
	const line = before.split("\n").length - 1;
	return [line, offset - (before.lastIndexOf("\n") + 1)];
}
