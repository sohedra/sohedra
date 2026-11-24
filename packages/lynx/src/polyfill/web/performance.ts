// `performance` and `Performance`: High Resolution Time § 4 "The Performance interface", with User
// Timing § 3 (`mark`, `measure`, the entries' list) and Performance Timeline § 4 (`getEntries…`).
// Both threads lack them (`lynx.performance` is Lynx's pipeline timing, not this). Svelte's
// `$inspect.trace()` and its motion tweens read `performance.now()`.
//
// Leaves out: the clock is `Date.now()`'s, in whole milliseconds, held from going back; there is no
// `PerformanceObserver` and no entry type but `mark` and `measure`.

import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import { domException } from "./dom-exception.ts";
import type {
	PerformanceClass,
	PerformanceEntryClass,
	PerformanceMarkClass,
	PerformanceMeasureClass,
} from "./standard-classes.ts";

/** @workaround web-performance kind=lynx-gap delete-when="Lynx's threads have a global performance" */
export function fillPerformance(scope: Scope): void {
	let made: ReturnType<typeof createPerformance> | undefined;
	const make = () => (made ??= createPerformance(scope));
	installLazy(scope, "performance", () => make().performance, isNow);
	for (const name of [
		"Performance",
		"PerformanceEntry",
		"PerformanceMark",
		"PerformanceMeasure",
	] as const)
		installLazy(scope, name, () => make()[name], isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";
const isNow = (existing: unknown): boolean =>
	typeof existing === "object" &&
	existing !== null &&
	typeof (existing as { now?: unknown }).now === "function";

/** What an entry holds. */
interface EntryFields {
	name: string;
	entryType: string;
	startTime: number;
	duration: number;
	detail: unknown;
}

/** The thread's `performance` and the classes of its entries. */
export function createPerformance(
	scope: Scope,
	clock: () => number = Date.now,
): {
	performance: Performance;
	Performance: PerformanceClass;
	PerformanceEntry: PerformanceEntryClass;
	PerformanceMark: PerformanceMarkClass;
	PerformanceMeasure: PerformanceMeasureClass;
} {
	const timeOrigin = clock();
	let last = 0;
	const now = (): number => (last = Math.max(last, clock() - timeOrigin));
	const entries: object[] = [];
	const fields = new WeakMap<object, EntryFields>();
	const read = (entry: object): EntryFields => {
		const found = fields.get(entry);
		if (!found) throw new TypeError("Illegal invocation: not a performance entry.");
		return found;
	};
	let constructing = false;

	class PerformanceEntryFill {
		constructor() {
			if (!constructing) throw new TypeError("PerformanceEntry can't be constructed.");
		}

		get name(): string {
			return read(this).name;
		}

		get entryType(): string {
			return read(this).entryType;
		}

		get startTime(): number {
			return read(this).startTime;
		}

		get duration(): number {
			return read(this).duration;
		}

		toJSON(): Record<string, unknown> {
			const { name, entryType, startTime, duration } = read(this);
			return { name, entryType, startTime, duration };
		}
	}

	/** An entry of `Class`, made by this fill. */
	const entry = <T extends object>(Class: new () => T, values: EntryFields): T => {
		constructing = true;
		try {
			const made = new Class();
			fields.set(made, values);
			return made;
		} finally {
			constructing = false;
		}
	};

	class PerformanceMarkFill extends PerformanceEntryFill {
		constructor(...args: [] | [name: string, options?: PerformanceMarkOptions]) {
			constructing = true;
			try {
				super();
			} finally {
				constructing = false;
			}
			if (args.length === 0)
				throw new TypeError("PerformanceMark takes a name, and none was given.");
			const [name, options] = args;
			const startTime = options?.startTime ?? now();
			if (startTime < 0) throw new TypeError("A PerformanceMark's startTime can't be negative.");
			fields.set(this, {
				name: `${name}`,
				entryType: "mark",
				startTime,
				duration: 0,
				detail: cloneDetail(scope, options?.detail),
			});
		}

		get detail(): unknown {
			return read(this).detail;
		}

		override toJSON(): Record<string, unknown> {
			return { ...super.toJSON(), detail: read(this).detail };
		}
	}

	class PerformanceMeasureFill extends PerformanceEntryFill {
		get detail(): unknown {
			return read(this).detail;
		}

		override toJSON(): Record<string, unknown> {
			return { ...super.toJSON(), detail: read(this).detail };
		}
	}

	/** The time of a mark by name (its last), or a time given as a number. */
	const timeOf = (mark: string | number, method: string): number => {
		if (typeof mark === "number") {
			if (mark < 0) throw new TypeError(`performance.${method} can't take a negative time.`);
			return mark;
		}
		for (let index = entries.length - 1; index >= 0; index--) {
			const found = read(entries[index]!);
			if (found.entryType === "mark" && found.name === mark) return found.startTime;
		}
		throw domException(scope, `performance.${method} found no mark named ${mark}.`, "SyntaxError");
	};

	const listed = (entryType?: string, name?: string): object[] =>
		entries
			.filter((each) => {
				const found = read(each);
				return (
					(entryType === undefined || found.entryType === entryType) &&
					(name === undefined || found.name === name)
				);
			})
			.sort((a, b) => read(a).startTime - read(b).startTime);

	const clear = (entryType: string, name?: string): void => {
		for (let index = entries.length - 1; index >= 0; index--) {
			const found = read(entries[index]!);
			if (found.entryType === entryType && (name === undefined || found.name === name))
				entries.splice(index, 1);
		}
	};

	let creatingPerformance = true;

	class PerformanceFill {
		constructor() {
			if (!creatingPerformance) throw new TypeError("Performance can't be constructed.");
		}

		get timeOrigin(): number {
			return timeOrigin;
		}

		now(): number {
			return now();
		}

		mark(name: string, options?: PerformanceMarkOptions): PerformanceMark {
			// Boundary: the class above, as TypeScript's DOM library types it.
			const mark = new PerformanceMarkFill(name, options) as unknown as PerformanceMark;
			entries.push(mark);
			return mark;
		}

		measure(
			name: string,
			start?: string | number | PerformanceMeasureOptions,
			end?: string | number,
		): PerformanceMeasure {
			let startTime = 0;
			let endTime = now();
			let detail: unknown = null;
			const options = typeof start === "object" && start !== null ? start : undefined;
			if (options) {
				const { start: from, end: to, duration } = options;
				if (
					from !== undefined ||
					to !== undefined ||
					duration !== undefined ||
					options.detail !== undefined
				) {
					if (end !== undefined)
						throw new TypeError("performance.measure takes options or an end mark, not both.");
					if (from === undefined && to === undefined)
						throw new TypeError("performance.measure takes a start or an end in its options.");
					if (from !== undefined && to !== undefined && duration !== undefined)
						throw new TypeError(
							"performance.measure takes two of start, end and duration, not three.",
						);
				}
				if (to !== undefined) endTime = timeOf(to, "measure");
				else if (from !== undefined && duration !== undefined)
					endTime = timeOf(from, "measure") + duration;
				if (from !== undefined) startTime = timeOf(from, "measure");
				else if (duration !== undefined && to !== undefined) startTime = endTime - duration;
				detail = cloneDetail(scope, options.detail);
			} else if (start !== undefined && typeof start !== "object")
				startTime = timeOf(`${start}`, "measure");
			// The positional marks are names (User Timing's `DOMString`), never times.
			if (end !== undefined) endTime = timeOf(`${end}`, "measure");
			const measure = entry(PerformanceMeasureFill, {
				name: `${name}`,
				entryType: "measure",
				startTime,
				duration: endTime - startTime,
				detail,
			});
			entries.push(measure);
			// Boundary: the class above, as TypeScript's DOM library types it.
			return measure as unknown as PerformanceMeasure;
		}

		getEntries(): PerformanceEntryList {
			return listed() as PerformanceEntryList;
		}

		getEntriesByType(type: string): PerformanceEntryList {
			return listed(`${type}`) as PerformanceEntryList;
		}

		getEntriesByName(name: string, type?: string): PerformanceEntryList {
			return listed(type === undefined ? undefined : `${type}`, `${name}`) as PerformanceEntryList;
		}

		clearMarks(name?: string): void {
			clear("mark", name === undefined ? undefined : `${name}`);
		}

		clearMeasures(name?: string): void {
			clear("measure", name === undefined ? undefined : `${name}`);
		}

		toJSON(): Record<string, unknown> {
			return { timeOrigin };
		}
	}

	const performance = new PerformanceFill();
	creatingPerformance = false;
	// Boundary: the classes above, as TypeScript's DOM library types them.
	return {
		performance: performance as unknown as Performance,
		Performance: named(PerformanceFill, "Performance") as unknown as PerformanceClass,
		PerformanceEntry: named(
			PerformanceEntryFill,
			"PerformanceEntry",
		) as unknown as PerformanceEntryClass,
		PerformanceMark: named(
			PerformanceMarkFill,
			"PerformanceMark",
		) as unknown as PerformanceMarkClass,
		PerformanceMeasure: named(
			PerformanceMeasureFill,
			"PerformanceMeasure",
		) as unknown as PerformanceMeasureClass,
	};
}

/** A mark's or a measure's `detail`, copied as the standard copies it; `null` when none. */
function cloneDetail(scope: Scope, detail: unknown): unknown {
	if (detail === undefined || detail === null) return null;
	// Boundary: the thread's `structuredClone`, which this folder fills on both threads.
	const clone = scope["structuredClone"] as ((value: unknown) => unknown) | undefined;
	return typeof clone === "function" ? clone(detail) : detail;
}
