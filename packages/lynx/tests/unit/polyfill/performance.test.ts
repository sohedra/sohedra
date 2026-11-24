// `performance` and its classes, as High Resolution Time § 4, User Timing § 3 and Performance
// Timeline § 4 define them, on a clock the test sets.

import { describe, expect, it } from "@rstest/core";

import { createPerformance, fillPerformance } from "../../../src/polyfill/web/performance.ts";
import { fillStructuredClone } from "../../../src/polyfill/web/structured-clone.ts";

/** A thread's `performance` on a clock that reads `time.now`. */
function timed(start = 1_000) {
	const time = { now: start };
	const scope: Record<string, unknown> = {};
	fillStructuredClone(scope);
	const made = createPerformance(scope, () => time.now);
	return { time, ...made };
}

/** What `run` throws. */
function thrown(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

describe("performance", () => {
	it("counts from its time origin, and never goes back", () => {
		const { time, performance } = timed();
		expect(performance.timeOrigin).toBe(1_000);
		expect(performance.now()).toBe(0);
		time.now = 1_250;
		expect(performance.now()).toBe(250);
		time.now = 1_100;
		expect(performance.now()).toBe(250);
		expect(performance.toJSON()).toEqual({ timeOrigin: 1_000 });
	});

	it("marks now or at a given time, with a copy of the detail", () => {
		const { time, performance, PerformanceMark, PerformanceEntry } = timed();
		time.now = 1_010;
		const detail = { n: 1 };
		const mark = performance.mark("a", { detail });
		expect(mark).toBeInstanceOf(PerformanceMark);
		expect(mark).toBeInstanceOf(PerformanceEntry);
		expect([mark.name, mark.entryType, mark.startTime, mark.duration]).toEqual([
			"a",
			"mark",
			10,
			0,
		]);
		expect(mark.detail).toEqual(detail);
		expect(mark.detail).not.toBe(detail);
		expect(performance.mark("b", { startTime: 3 }).startTime).toBe(3);
		expect(performance.mark("c").detail).toBeNull();
		expect(mark.toJSON()).toEqual({
			name: "a",
			entryType: "mark",
			startTime: 10,
			duration: 0,
			detail,
		});
	});

	it("measures between marks, times, and options, as User Timing does", () => {
		const { time, performance } = timed();
		performance.mark("start", { startTime: 5 });
		performance.mark("end", { startTime: 25 });
		time.now = 1_040;
		const shapes = [
			performance.measure("whole"),
			performance.measure("from", "start"),
			performance.measure("between", "start", "end"),
			performance.measure("options", { start: "start", end: 30 }),
			performance.measure("duration", { start: 10, duration: 5 }),
			performance.measure("backwards", { end: "end", duration: 5 }),
		];
		expect(shapes.map((each) => [each.name, each.startTime, each.duration])).toEqual([
			["whole", 0, 40],
			["from", 5, 35],
			["between", 5, 20],
			["options", 5, 25],
			["duration", 10, 5],
			["backwards", 20, 5],
		]);
		expect(performance.measure("d", { start: 0, detail: [1] }).detail).toEqual([1]);
		expect(shapes[0]!.entryType).toBe("measure");
	});

	it("refuses what User Timing refuses", () => {
		const { performance } = timed();
		const missing = thrown(() => performance.measure("x", "no such mark"));
		expect((missing as DOMException).name).toBe("SyntaxError");
		expect(() => performance.measure("x", { start: 1 }, "end")).toThrow(TypeError);
		expect(() => performance.measure("x", { duration: 1 })).toThrow(TypeError);
		expect(() => performance.measure("x", { start: 1, end: 2, duration: 1 })).toThrow(TypeError);
		expect(() => performance.mark("x", { startTime: -1 })).toThrow(TypeError);
		expect(() => performance.measure("x", { start: -1 })).toThrow(TypeError);
		// A mark given in place is a name, even one that reads as a number.
		performance.mark("5", { startTime: 7 });
		expect(performance.measure("x", 5 as unknown as string).startTime).toBe(7);
		expect((thrown(() => performance.measure("x", "6")) as DOMException).name).toBe("SyntaxError");
	});

	it("lists its entries by start time, by type and by name, and clears them", () => {
		const { performance } = timed();
		performance.mark("late", { startTime: 9 });
		performance.mark("early", { startTime: 1 });
		performance.measure("m", { start: 2, end: 3 });
		expect(performance.getEntries().map((entry) => entry.name)).toEqual(["early", "m", "late"]);
		expect(performance.getEntriesByType("mark").map((entry) => entry.name)).toEqual([
			"early",
			"late",
		]);
		expect(performance.getEntriesByName("m").length).toBe(1);
		expect(performance.getEntriesByName("m", "mark")).toEqual([]);
		performance.clearMarks("late");
		expect(performance.getEntriesByType("mark").map((entry) => entry.name)).toEqual(["early"]);
		performance.clearMarks();
		performance.clearMeasures();
		expect(performance.getEntries()).toEqual([]);
	});

	it("takes the last mark of a name", () => {
		const { performance } = timed();
		performance.mark("a", { startTime: 1 });
		performance.mark("a", { startTime: 4 });
		expect(performance.measure("m", "a", "a").startTime).toBe(4);
	});

	it("makes marks with new, but no Performance or plain entry", () => {
		const { Performance, PerformanceEntry, PerformanceMark, performance } = timed();
		expect(new PerformanceMark("made").entryType).toBe("mark");
		expect(performance.getEntries()).toEqual([]);
		expect(() => new (Performance as unknown as new () => unknown)()).toThrow(TypeError);
		expect(() => new (PerformanceEntry as unknown as new () => unknown)()).toThrow(TypeError);
		expect(() => new (PerformanceMark as unknown as new () => unknown)()).toThrow(TypeError);
		expect(Object.prototype.toString.call(performance)).toBe("[object Performance]");
	});
});

describe("the fill", () => {
	it("puts performance and its classes on a thread that lacks them, made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillPerformance(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "performance")?.get).toBeTypeOf("function");
		const performance = scope["performance"] as Performance;
		expect(performance).toBeInstanceOf(scope["Performance"] as typeof Performance);
		expect(typeof performance.now()).toBe("number");
	});

	it("leaves a thread's own performance, and replaces one without now, such as lynx's", () => {
		const own = { now: () => 1 };
		const scope: Record<string, unknown> = { performance: own };
		fillPerformance(scope);
		expect(scope["performance"]).toBe(own);
		const lynxLike: Record<string, unknown> = { performance: { addTimingListener() {} } };
		fillPerformance(lynxLike);
		expect(typeof (lynxLike["performance"] as Performance).now).toBe("function");
	});
});
