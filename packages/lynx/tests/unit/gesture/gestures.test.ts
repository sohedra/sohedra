// The gesture classes: each instance is the gesture as it crosses to the main thread, made from one
// options object, its relations among them. Relations name gestures by their own ids; a composition
// gives its members the relations it means, on copies.

import { describe, expect, it } from "@rstest/core";

import * as experimental from "../../../src/gesture/experimental.ts";
import {
	ExclusiveGesture,
	FlingGesture,
	LongPressGesture,
	NativeGesture,
	RaceGesture,
	SimultaneousGesture,
} from "../../../src/gesture/experimental.ts";
import { DefaultScrollGesture, PanGesture, TapGesture } from "../../../src/gesture/index.ts";
import type { Gesture } from "../../../src/gesture/index.ts";
import { isGesture, plainGestures } from "../../../src/wire/index.ts";
import type { SerializedGesture, SerializedPlainGesture } from "../../../src/wire/index.ts";

// A main-thread function as the compile step makes it.
const fn = (id: string) => ({ _wkltId: id }) as unknown as () => void;
const sent = (gesture: Gesture) => JSON.parse(JSON.stringify(gesture)) as SerializedGesture;
const plain = (gesture: Gesture) => sent(gesture) as SerializedPlainGesture;
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

	it.each(["simultaneousWith", "waitFor", "continueWith"] as const)(
		"refuses a %s that is not a list of gestures, through its catalogue, naming the option",
		(name) => {
			const fake = { id: 1 } as unknown as Gesture;
			expect(() => new PanGesture({ [name]: [fake] })).toThrow(
				expect.objectContaining({
					code: "gesture_relation_not_gesture",
					message: expect.stringMatching(new RegExp(`^The ${name} of a PanGesture holds a value`)),
				}),
			);
			const scroll = new DefaultScrollGesture();
			expect(() => new PanGesture({ [name]: scroll as unknown as Gesture[] })).toThrow(
				expect.objectContaining({ code: "gesture_relation_not_a_list" }),
			);
			expect(() => new TapGesture({ [name]: scroll as never })).toThrow(
				new RegExp(`^The ${name} of a TapGesture is not a list of gestures\\.`),
			);
		},
	);

	it("refuses a composition's member that is no gesture", () => {
		const fake = { id: 1 } as unknown as Gesture;
		expect(() => new RaceGesture(new PanGesture(), fake)).toThrow(
			expect.objectContaining({
				code: "gesture_member_not_gesture",
				message: expect.stringMatching(/^A RaceGesture was given a value that is not a gesture/),
			}),
		);
	});

	it("names in its relations the plain gestures it is given, each once, never itself", () => {
		const tap = new TapGesture();
		const scroll = new DefaultScrollGesture();
		const race = new RaceGesture(tap, scroll);
		const pan = new PanGesture({ simultaneousWith: [scroll], waitFor: [tap, tap, race] });
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

describe("the relation options", () => {
	it("send each relation as Lynx's gesture runtime serializes it: the ids, in order", () => {
		const [pan, fling, scroll] = [new PanGesture(), new FlingGesture(), new DefaultScrollGesture()];
		const tap = new TapGesture({
			waitFor: [pan],
			simultaneousWith: [scroll],
			continueWith: [fling],
		});
		const value = plain(tap);
		expect([value.waitFor, value.simultaneousWith, value.continueWith]).toEqual([
			[{ id: plain(pan).id }],
			[{ id: plain(scroll).id }],
			[{ id: plain(fling).id }],
		]);
		// Built after the gestures it names, with an id of its own.
		expect(value.id).toBe(plain(scroll).id + 1);
	});

	it("name a gesture given twice once", () => {
		const pan = new PanGesture();
		const press = new LongPressGesture({ continueWith: [pan, pan] });
		expect(ids(plain(press).continueWith)).toEqual([plain(pan).id]);
	});

	it("keep a composition's members' own relations beside the composition's", () => {
		const [pan, fling] = [new PanGesture(), new FlingGesture()];
		const tap = new TapGesture({ waitFor: [fling], continueWith: [fling] });
		const members = plainGestures(sent(new ExclusiveGesture(pan, tap)));
		expect(ids(members[1]!.waitFor)).toEqual([plain(fling).id, plain(pan).id]);
		expect(ids(members[1]!.continueWith)).toEqual([plain(fling).id]);
	});

	it("are no functions of the experimental entry", () => {
		expect(Object.keys(experimental)).not.toContain("waitFor");
		expect(Object.keys(experimental)).not.toContain("continueWith");
	});
});
