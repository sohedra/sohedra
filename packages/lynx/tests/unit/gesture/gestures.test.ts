// The gesture classes: each instance is the gesture as it crosses to the main thread, made from one
// options object. Relations name gestures by their own ids; a composition gives its members the
// relations it means, on copies.

import { describe, expect, it } from "@rstest/core";

import {
	continueWith,
	ExclusiveGesture,
	FlingGesture,
	LongPressGesture,
	NativeGesture,
	RaceGesture,
	SimultaneousGesture,
} from "../../../src/gesture/experimental.ts";
import { DefaultScrollGesture, PanGesture, TapGesture } from "../../../src/gesture/index.ts";
import type { GestureKind } from "../../../src/gesture/index.ts";
import { isGesture, plainGestures } from "../../../src/wire/index.ts";
import type { SerializedGesture, SerializedPlainGesture } from "../../../src/wire/index.ts";

// A main-thread function as the compile step makes it.
const fn = (id: string) => ({ _wkltId: id }) as unknown as () => void;
const sent = (gesture: GestureKind) => JSON.parse(JSON.stringify(gesture)) as SerializedGesture;
const plain = (gesture: GestureKind) => sent(gesture) as SerializedPlainGesture;
const ids = (refs: { id: number }[]) => refs.map((ref) => ref.id);

describe("a gesture", () => {
	it("is the shape Lynx's detectors are set from, and crosses as it is", () => {
		const pan = new PanGesture({
			minDistance: 8,
			onUpdate: fn("a:update"),
			onBegin: fn("a:begin"),
		});
		const value = plain(pan);
		expect(value).toEqual({
			__isSerialized: true,
			id: value.id,
			type: 0,
			config: { minDistance: 8 },
			// In the order Lynx calls them, whatever the order of the options.
			callbacks: { onBegin: { _wkltId: "a:begin" }, onUpdate: { _wkltId: "a:update" } },
			waitFor: [],
			simultaneousWith: [],
			continueWith: [],
		});
		expect(isGesture(pan)).toBe(true);
		// Its own fields: nothing to call to send it.
		expect(Object.keys(pan)).toEqual(Object.keys(value));
	});

	it("writes every option with a default, which iOS reads as 0 when missing", () => {
		expect(plain(new PanGesture()).config).toEqual({ minDistance: 0 });
		expect(plain(new TapGesture()).config).toEqual({ maxDuration: 500, maxDistance: 10 });
		expect(plain(new TapGesture({ maxDuration: 200 })).config).toEqual({
			maxDuration: 200,
			maxDistance: 10,
		});
		expect(plain(new DefaultScrollGesture()).config).toEqual({ tapSlop: 3 });
		expect(plain(new LongPressGesture()).config).toEqual({ minDuration: 500, maxDistance: 10 });
		expect(plain(new FlingGesture()).config).toEqual({});
		expect(plain(new NativeGesture()).config).toEqual({});
		expect(
			[
				PanGesture,
				FlingGesture,
				DefaultScrollGesture,
				TapGesture,
				LongPressGesture,
				NativeGesture,
			].map((Gesture) => plain(new Gesture()).type),
		).toEqual([0, 1, 2, 3, 4, 7]);
	});

	it("takes ids of its own on the background, each once", () => {
		const [a, b] = [new PanGesture(), new PanGesture()].map((gesture) => plain(gesture).id);
		expect(a).toBeGreaterThan(0);
		expect(b).toBe(a! + 1);
	});

	it("refuses a callback that is not a main-thread function, naming it", () => {
		expect(() => new PanGesture({ onUpdate: () => {} })).toThrow(
			expect.objectContaining({ code: "gesture_callback_not_main_thread" }),
		);
		expect(() => new TapGesture({ onEnd: () => {} })).toThrow(/The onEnd given to a TapGesture/);
	});

	it("refuses a relation that is not a gesture", () => {
		const fake = { id: 1 } as unknown as GestureKind;
		expect(() => new PanGesture({ waitFor: [fake] })).toThrow(
			expect.objectContaining({ code: "gesture_relation_not_gesture" }),
		);
		expect(() => new RaceGesture(fake)).toThrow(/The gestures of a RaceGesture/);
	});

	it("names in its relations the plain gestures it is given, each once, never itself", () => {
		const tap = new TapGesture();
		const scroll = new DefaultScrollGesture();
		const race = new RaceGesture(tap, scroll);
		const pan = new PanGesture({ waitFor: [tap, tap, race], simultaneousWith: [scroll] });
		const tapId = plain(tap).id;
		const scrollId = plain(scroll).id;
		expect(ids(plain(pan).waitFor)).toEqual([tapId, scrollId]);
		expect(ids(plain(pan).simultaneousWith)).toEqual([scrollId]);
	});
});

describe("a composition", () => {
	it("of Exclusive makes each member wait for those before it", () => {
		const [pan, tap, press] = [new PanGesture(), new TapGesture(), new LongPressGesture()];
		const members = plainGestures(sent(new ExclusiveGesture(pan, tap, press)));
		expect(members.map((member) => ids(member.waitFor))).toEqual([
			[],
			[plain(pan).id],
			[plain(pan).id, plain(tap).id],
		]);
		// The members themselves are left as they were.
		expect(plain(tap).waitFor).toEqual([]);
	});

	it("of Simultaneous runs each member with all the others, an exclusive one inside staying so", () => {
		const [pan, tap, press] = [new PanGesture(), new TapGesture(), new LongPressGesture()];
		const value = sent(new SimultaneousGesture(new ExclusiveGesture(tap, press), pan));
		const [tapId, pressId, panId] = [tap, press, pan].map((gesture) => plain(gesture).id);
		expect(value).toMatchObject({ type: -1, gestures: [{ type: -1 }, { id: panId }] });
		const members = plainGestures(value);
		expect(members.map((member) => member.id)).toEqual([tapId, pressId, panId]);
		expect(members.map((member) => ids(member.simultaneousWith))).toEqual([
			[panId],
			[panId],
			[tapId, pressId],
		]);
		expect(ids(members[1]!.waitFor)).toEqual([tapId]);
	});

	it("of Race relates no member to another", () => {
		const members = plainGestures(sent(new RaceGesture(new PanGesture(), new TapGesture())));
		expect(members.map((member) => [member.waitFor, member.simultaneousWith])).toEqual([
			[[], []],
			[[], []],
		]);
	});
});

describe("continueWith", () => {
	it("is a copy of the gesture, of its class, that hands the touch to the next ones", () => {
		const pan = new PanGesture({ onUpdate: fn("a:update") });
		const fling = new FlingGesture();
		const next = continueWith(pan, [fling]);
		expect(next).toBeInstanceOf(PanGesture);
		expect(ids(plain(next).continueWith)).toEqual([plain(fling).id]);
		expect(plain(next).id).toBe(plain(pan).id);
		expect(plain(pan).continueWith).toEqual([]);
	});

	it("of a composition hands each member's touch on", () => {
		const fling = new FlingGesture();
		const members = plainGestures(
			sent(continueWith(new RaceGesture(new PanGesture(), new TapGesture()), [fling])),
		);
		expect(members.map((member) => ids(member.continueWith))).toEqual([
			[plain(fling).id],
			[plain(fling).id],
		]);
	});
});
