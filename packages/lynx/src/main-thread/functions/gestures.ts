// `main-thread:gesture`: Lynx's gesture detectors on the page's elements, one for each plain
// gesture of an element's value (../../gesture/).
//
// Lynx knows a detector by an id the page gives (a native id), and relations name detectors by
// those ids. A gesture's own id changes whenever it is built again (`$derived`) and at hydration,
// where the background's gesture takes the first frame's place; Android registers an element's
// detector ids once, when it first joins the gesture arena. So a gesture's native id stays with
// its place: a gesture the page knows keeps its native id, and a new one takes the native id of the
// detector it replaces on its element. The ids are given out at the settle step, for every element
// whose gesture changed since, before any detector is set: a relation may name a gesture set later
// in the same patch, or rebuilt in it.
//
// The engine holds one entry for each callback of a detector (./bindings.ts). A gesture built again
// with only other callbacks, or callbacks with other captured values, swaps them into the entries:
// the detector stays, and so does a drag in progress, as Lynx's own templates do (core/renderer/dom/
// fiber/tree_resolver.cc). A change of type, config, relations or callback names sets the detector
// again, which ends a drag.
//
// Each detector has one state manager, made with it, which a callback gets as its second
// argument: it moves that detector along through the engine's gesture manager.

import { GestureState, isGesture, isMainThreadFunction, plainGestures } from "../../wire/index.ts";
import type { GestureRef, SerializedPlainGesture } from "../../wire/index.ts";
import { mainThread } from "../globals.ts";
import type { LynxElement } from "../globals.ts";
import { Entry } from "./bindings.ts";
import type { Binding, BindingScope, GestureDetectors } from "./bindings.ts";

/** A detector of an element: one plain gesture of its value. */
interface Detector {
	/** The gesture's own id, which relations name it by. */
	own: number;
	/** The id Lynx knows it by. */
	native: number;
	/** Its type, config, relations and callback names, as text: a difference sets it again. */
	shape: string;
	/** The own ids its relations name. */
	related: number[];
	/** The entry of each callback, by name. */
	entries: Map<string, Entry>;
}

/** The engine's gesture manager, as a callback is handed it: read by plain property reads. */
interface EngineManager {
	__SetGestureState(element: LynxElement, id: number, state: number): void;
	__ConsumeGesture(
		element: LynxElement,
		id: number,
		params: { consume: boolean; inner: boolean },
	): void;
}

/** What a detector's callbacks get as their second argument. */
export interface DetectorState {
	active(): void;
	fail(): void;
	end(): void;
	consumeGesture(consume: boolean): void;
	interceptGesture(intercept: boolean): void;
}

/**
 * The state manager of the detector `native` on `element`, made once: what the engine hands a
 * callback, made into it. The engine's manager is read on each call, so one it hands anew works.
 */
function stateManager(element: LynxElement, native: number): (engine: unknown) => DetectorState {
	let manager: EngineManager | undefined;
	const state: DetectorState = {
		active: () => manager?.__SetGestureState(element, native, GestureState.ACTIVE),
		fail: () => manager?.__SetGestureState(element, native, GestureState.FAIL),
		end: () => manager?.__SetGestureState(element, native, GestureState.END),
		consumeGesture: (consume) =>
			manager?.__ConsumeGesture(element, native, { consume: consume, inner: true }),
		interceptGesture: (intercept) =>
			manager?.__ConsumeGesture(element, native, { consume: intercept, inner: false }),
	};
	return (engine) => {
		// Boundary: the engine's gesture manager has no types; `EngineManager` gives its two calls.
		manager = engine as EngineManager;
		return state;
	};
}

/** What the settle step does for one binding: its gestures, and the native id of each. */
interface Plan {
	binding: Binding;
	gestures: SerializedPlainGesture[];
	natives: number[];
	before: Detector[];
}

/** The page's gesture detectors. */
export interface Gestures extends GestureDetectors {
	/** Sets the detectors of the bindings due since, native ids first. */
	flush(): void;
	/** The page goes: nothing waits to be set. */
	silence(): void;
	/** How many detectors the page holds, and how many gestures' ids, for tests. */
	sizes(): { detectors: number; ids: number };
}

/** The gesture detectors of a page, whose bindings reach `scope`. */
export function createGestures(scope: () => BindingScope): Gestures {
	const detectors = new Map<Binding, Detector[]>();
	/** A gesture's own id → the native id Lynx knows it by. */
	const natives = new Map<number, number>();
	/** How many detectors hold each own id, as theirs or in a relation. */
	const holds = new Map<number, number>();
	let nextNative = 1;
	let due = new Set<Binding>();

	function hold(own: number): void {
		holds.set(own, (holds.get(own) ?? 0) + 1);
	}

	function letGo(own: number): void {
		const count = (holds.get(own) ?? 0) - 1;
		if (count > 0) {
			holds.set(own, count);
			return;
		}
		holds.delete(own);
		natives.delete(own);
	}

	/** The native id of the gesture `own`: one is given now to a gesture not set yet. */
	function nativeOf(own: number): number {
		let native = natives.get(own);
		if (native === undefined) natives.set(own, (native = nextNative++));
		return native;
	}

	function relationIds(refs: readonly GestureRef[], related: number[]): number[] {
		return refs.map(({ id }) => {
			related.push(id);
			return nativeOf(id);
		});
	}

	/** Native ids for a plan's gestures: a known gesture keeps its own, a new one its place's. */
	function giveIds(plan: Plan): void {
		const { gestures, before, natives: given } = plan;
		const owns = new Set(gestures.map((gesture) => gesture.id));
		// The natives of the detectors this value no longer has, in order: free for new gestures.
		const free = before
			.filter((detector) => !owns.has(detector.own))
			.map((detector) => detector.native);
		gestures.forEach((gesture, index) => {
			let native = natives.get(gesture.id);
			if (native === undefined) {
				native = free.find((id) => !given.includes(id)) ?? nextNative++;
				natives.set(gesture.id, native);
			}
			given[index] = native;
			// Held from now, so the detectors that go let go of nothing it needs.
			hold(gesture.id);
		});
	}

	function remove(element: LynxElement, detector: Detector): void {
		mainThread.__RemoveGestureDetector(element, detector.native);
	}

	/** Sets one gesture of a plan; returns its detector, once the engine has it. */
	function setDetector(plan: Plan, index: number, reused: Set<Detector>): Detector {
		const { binding, gestures, natives: given, before } = plan;
		const gesture = gestures[index]!;
		const native = given[index]!;
		const related: number[] = [];
		const relations = {
			waitFor: relationIds(gesture.waitFor, related),
			simultaneous: relationIds(gesture.simultaneousWith, related),
			continueWith: relationIds(gesture.continueWith, related),
		};
		const names = Object.keys(gesture.callbacks).filter((name) =>
			isMainThreadFunction(gesture.callbacks[name]),
		);
		const shape = JSON.stringify([gesture.type, gesture.config, relations, names]);
		const old = before.find((detector) => detector.native === native && !reused.has(detector));
		if (old) reused.add(old);
		if (old && old.shape === shape) {
			// Only the callbacks changed: the engine's entries run the new ones.
			for (const name of names) {
				const entry = old.entries.get(name)!;
				const fn = gesture.callbacks[name]!;
				if (entry.fn !== fn) entry.swap(fn);
			}
			return { own: gesture.id, native, shape, related, entries: old.entries };
		}
		const manager = stateManager(binding.element, native);
		const entries = new Map<string, Entry>();
		for (const name of names) {
			const entry = new Entry(gesture.callbacks[name]!, scope());
			entry.manager = manager;
			entries.set(name, entry);
		}
		// Set again: what was recognized of a touch ends.
		if (old) remove(binding.element, old);
		mainThread.__SetGestureDetector(
			binding.element,
			native,
			gesture.type,
			{
				callbacks: [...entries].map(([name, entry]) => ({ name, callback: entry })),
				config: gesture.config,
			},
			relations,
		);
		return { own: gesture.id, native, shape, related, entries };
	}

	/**
	 * Sets a plan's detectors, each on its own: those that differ only in their callbacks keep their
	 * detector, and one the engine refuses is reported and left out.
	 */
	function setDetectors(plan: Plan): void {
		const { binding, gestures, before } = plan;
		const { guarded } = scope();
		const after: Detector[] = [];
		const reused = new Set<Detector>();
		gestures.forEach((gesture, index) => {
			guarded(() => {
				const detector = setDetector(plan, index, reused);
				after.push(detector);
				for (const id of detector.related) hold(id);
			});
		});
		for (const detector of before)
			if (!reused.has(detector)) guarded(() => remove(binding.element, detector));
		if (after.length > 0) detectors.set(binding, after);
		else detectors.delete(binding);
		// What went, or the engine refused, lets go of the ids it held.
		for (const detector of before) {
			letGo(detector.own);
			for (const id of detector.related) letGo(id);
		}
		const kept = new Set(after.map((detector) => detector.own));
		for (const gesture of gestures) if (!kept.has(gesture.id)) letGo(gesture.id);
	}

	return {
		due(binding) {
			due.add(binding);
		},
		release(binding) {
			const before = detectors.get(binding);
			if (!before) return;
			detectors.delete(binding);
			for (const detector of before) {
				letGo(detector.own);
				for (const id of detector.related) letGo(id);
				scope().guarded(() => remove(binding.element, detector));
			}
		},
		flush() {
			if (due.size === 0) return;
			const batch = due;
			due = new Set();
			const plans: Plan[] = [];
			for (const binding of batch) {
				if (binding.released) continue;
				const { value } = binding;
				plans.push({
					binding,
					gestures: isGesture(value) ? plainGestures(value) : [],
					natives: [],
					before: detectors.get(binding) ?? [],
				});
			}
			for (const plan of plans) giveIds(plan);
			for (const plan of plans) setDetectors(plan);
		},
		silence() {
			due = new Set();
		},
		sizes() {
			let count = 0;
			for (const list of detectors.values()) count += list.length;
			return { detectors: count, ids: natives.size };
		},
	};
}
