// `main-thread:gesture`: Lynx's gesture detectors on the page's elements, one for each plain
// gesture of an element's value (../../gesture/).
//
// Lynx knows a detector by an id the page gives (a native id), and relations name detectors by
// those ids. A gesture's own id changes whenever it is built again (`$derived`) and at hydration,
// where the background's gesture takes the first frame's place; Android registers an element's
// detector ids once, when it first joins the gesture arena (GestureArenaManager.addMember). So
// native ids stay with their element, which keeps the ids it had for as long as it lives, also
// while it has no gesture: a gesture set on it again, or a new one there, takes them. A gesture
// keeps its native id while a detector of another element has it; one that only relations know
// yet takes its element's place, and what names it is set again. No two gestures share an id: one
// whose id the batch gave another gets a new id, and what names it is set again. One gesture on
// several elements that had different ids takes one id: the others are set again under it, and on
// Android a relation to it does not find them, since they joined the arena under their own.
//
// The ids are given out at the settle step, for every element whose gesture changed since, before
// any detector is set: a relation may name a gesture set later in the same patch, or rebuilt in
// it. Places first, over the whole batch, then new ids: an element made in the batch never takes
// an id another element keeps.
//
// The engine holds one entry for each callback of a detector (./bindings.ts). A gesture built again
// with only other callbacks, or callbacks with other captured values, swaps them into the entries:
// no engine call, so the detector stays, and so does a drag in progress, as Lynx's own templates
// do (core/renderer/dom/fiber/tree_resolver.cc). A change of type, config, relations or callback
// names sets the detector again, which ends a drag; so does setting another detector of the same
// element, since the platform rebuilds all of an element's handlers.
//
// Taking an element's last gesture away stops its callbacks, but Android is not told: an element
// with no detector sends the platform no set, and its handlers stay in the arena until the element
// goes (LynxUIOwner.updateProperties). The element's ids are kept, so a gesture set on it again
// meets them.
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
interface DetectorState {
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
	/** The native id of each gesture, once given. */
	natives: (number | undefined)[];
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

/** Adds `by` to `key`'s count, dropping it at 0. */
function count<Key>(counts: Map<Key, number>, key: Key, by: number): void {
	const next = (counts.get(key) ?? 0) + by;
	if (next > 0) counts.set(key, next);
	else counts.delete(key);
}

/** The gesture detectors of a page, whose bindings reach `scope`. */
export function createGestures(scope: () => BindingScope): Gestures {
	const detectors = new Map<Binding, Detector[]>();
	/** The native ids each element has had, in order, while it lives. */
	const places = new Map<LynxElement, number[]>();
	/** A gesture's own id → the native id Lynx knows it by. */
	const natives = new Map<number, number>();
	/** A native id → the own ids that have it. */
	const owners = new Map<number, Set<number>>();
	/** How many detectors hold each own id, as theirs or in a relation. */
	const holds = new Map<number, number>();
	/** How many detectors are set under each native id. */
	const used = new Map<number, number>();
	let nextNative = 1;
	let due = new Set<Binding>();

	function name(own: number, native: number): void {
		const before = natives.get(own);
		if (before === native) return;
		if (before !== undefined) owners.get(before)?.delete(own);
		natives.set(own, native);
		let set = owners.get(native);
		if (!set) owners.set(native, (set = new Set()));
		set.add(own);
	}

	function unname(own: number): void {
		const native = natives.get(own);
		if (native === undefined) return;
		natives.delete(own);
		const set = owners.get(native);
		set?.delete(own);
		if (set?.size === 0) owners.delete(native);
	}

	/** The native id of the gesture `own`: one is given now to a gesture not set yet. */
	function nativeOf(own: number): number {
		let native = natives.get(own);
		if (native === undefined) name(own, (native = nextNative++));
		return native;
	}

	function relationIds(refs: readonly GestureRef[], related: number[]): number[] {
		return refs.map(({ id }) => {
			related.push(id);
			return nativeOf(id);
		});
	}

	/** The detector is the binding's from now on. */
	function keep(detector: Detector): void {
		count(holds, detector.own, 1);
		for (const id of detector.related) count(holds, id, 1);
		count(used, detector.native, 1);
	}

	/** The detector is the binding's no more. */
	function letGo(detector: Detector): void {
		count(holds, detector.own, -1);
		for (const id of detector.related) count(holds, id, -1);
		count(used, detector.native, -1);
	}

	/** Forgets the own ids no detector holds. */
	function sweep(ids: Iterable<number>): void {
		for (const id of ids) if (!holds.has(id)) unname(id);
	}

	function remove(element: LynxElement, detector: Detector): void {
		mainThread.__RemoveGestureDetector(element, detector.native);
	}

	/** Gives the batch's gestures their native ids: places first, over the whole batch. */
	function giveIds(plans: Plan[]): void {
		const leavingHolds = new Map<number, number>();
		const leavingUses = new Map<number, number>();
		const leave = (plan: Plan): void => {
			for (const detector of plan.before) {
				count(leavingHolds, detector.own, 1);
				for (const id of detector.related) count(leavingHolds, id, 1);
				count(leavingUses, detector.native, 1);
			}
		};
		/** Whether a detector the batch does not replace holds `own`. */
		const heldElsewhere = (own: number): boolean =>
			(holds.get(own) ?? 0) > (leavingHolds.get(own) ?? 0);
		/** Whether a detector the batch does not replace is set under `native`. */
		const setElsewhere = (native: number): boolean =>
			(used.get(native) ?? 0) > (leavingUses.get(native) ?? 0);
		const placed = new Map<number, number>();
		const taken = new Set<number>();
		/** Whether `native` is someone else's than `own`'s. */
		const busy = (native: number, own: number): boolean => {
			if (taken.has(native) || setElsewhere(native)) return true;
			for (const other of owners.get(native) ?? [])
				if (other !== own && heldElsewhere(other) && !placed.has(other)) return true;
			return false;
		};
		const moved = new Set<number>();

		/** A plan's gestures that a detector elsewhere keeps, or that take a place of their element. */
		const place = (plan: Plan): void => {
			const mine = places.get(plan.binding.element) ?? [];
			plan.gestures.forEach((gesture, index) => {
				const { id } = gesture;
				let native = placed.get(id);
				// Set on another element: it keeps its id there.
				const current = natives.get(id);
				if (native === undefined && current !== undefined && setElsewhere(current))
					native = current;
				if (native === undefined) {
					native =
						current !== undefined && mine.includes(current) && !busy(current, id)
							? current
							: mine.find((free) => !busy(free, id) && !plan.natives.includes(free));
					if (native !== undefined && current !== undefined && current !== native) moved.add(id);
				}
				if (native === undefined) return;
				plan.natives[index] = native;
				placed.set(id, native);
				taken.add(native);
			});
		};

		const inBatch = new Set(plans.map((plan) => plan.binding));
		for (const plan of plans) leave(plan);
		// A gesture placed elsewhere frees the id it had: try again until none is placed.
		for (let before = -1; before !== placed.size;) {
			before = placed.size;
			for (const plan of plans) place(plan);
		}
		// The rest: a gesture keeps the id it has unless the batch gave it to another; else a new one.
		const rest = (plan: Plan): void =>
			plan.gestures.forEach((gesture, index) => {
				if (plan.natives[index] !== undefined) return;
				const current = natives.get(gesture.id);
				let native = placed.get(gesture.id);
				if (native === undefined) {
					native = current !== undefined && !taken.has(current) ? current : nextNative++;
					if (current !== undefined && current !== native) moved.add(gesture.id);
				}
				plan.natives[index] = native;
				placed.set(gesture.id, native);
				taken.add(native);
			});
		for (const plan of plans) rest(plan);
		// What names a gesture that moved is set again, with the new id; its own gesture keeps its id
		// unless the batch gave that to another, and then what names it is set again in turn.
		for (let named = 0; named !== moved.size;) {
			named = moved.size;
			for (const [binding, list] of detectors) {
				if (inBatch.has(binding)) continue;
				if (!list.some((detector) => detector.related.some((id) => moved.has(id)))) continue;
				const plan = planOf(binding);
				if (!plan) continue;
				plans.push(plan);
				inBatch.add(binding);
				leave(plan);
				place(plan);
				rest(plan);
			}
		}
		for (const [own, native] of placed) name(own, native);
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
		const names = Object.keys(gesture.callbacks).filter((callback) =>
			isMainThreadFunction(gesture.callbacks[callback]),
		);
		const shape = JSON.stringify([gesture.type, gesture.config, relations, names]);
		const old = before.find((detector) => detector.native === native && !reused.has(detector));
		if (old) reused.add(old);
		if (old && old.shape === shape) {
			// Only the callbacks changed: the engine's entries run the new ones.
			for (const callback of names) {
				const entry = old.entries.get(callback)!;
				const fn = gesture.callbacks[callback]!;
				if (entry.fn !== fn) entry.swap(fn);
			}
			return { own: gesture.id, native, shape, related, entries: old.entries };
		}
		const manager = stateManager(binding.element, native);
		const entries = new Map<string, Entry>();
		for (const callback of names) {
			const entry = new Entry(gesture.callbacks[callback]!, scope());
			entry.manager = manager;
			entries.set(callback, entry);
		}
		// It replaces the detector under its id, if any: what was recognized of a touch ends.
		mainThread.__SetGestureDetector(
			binding.element,
			native,
			gesture.type,
			{
				callbacks: [...entries].map(([callback, entry]) => ({ name: callback, callback: entry })),
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
		const { element } = binding;
		const { guarded } = scope();
		const after: Detector[] = [];
		const reused = new Set<Detector>();
		// The detectors need the element's own view.
		if (gestures.length > 0) scope().flattening.hold(element);
		gestures.forEach((_, index) => {
			guarded(() => {
				const detector = setDetector(plan, index, reused);
				after.push(detector);
				keep(detector);
			});
		});
		for (const detector of before)
			if (!reused.has(detector)) guarded(() => remove(element, detector));
		for (const detector of before) letGo(detector);
		if (after.length > 0) {
			detectors.set(binding, after);
			places.set(element, [
				...after.map((detector) => detector.native),
				...(places.get(element) ?? []).filter(
					(native) => !after.some((detector) => detector.native === native),
				),
			]);
		} else detectors.delete(binding);
	}

	/** What the settle step does for `binding`, as its value is now. */
	function planOf(binding: Binding): Plan | undefined {
		if (binding.released) return undefined;
		const { value } = binding;
		let gestures: SerializedPlainGesture[] = [];
		scope().guarded(() => {
			if (isGesture(value)) gestures = plainGestures(value);
		});
		return { binding, gestures, natives: [], before: detectors.get(binding) ?? [] };
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
				letGo(detector);
				scope().guarded(() => remove(binding.element, detector));
			}
			sweep(before.flatMap((detector) => [detector.own, ...detector.related]));
		},
		forget(element) {
			places.delete(element);
		},
		flush() {
			if (due.size === 0) return;
			const batch = due;
			due = new Set();
			const plans: Plan[] = [];
			for (const binding of batch) {
				const plan = planOf(binding);
				if (plan) plans.push(plan);
			}
			giveIds(plans);
			for (const plan of plans) setDetectors(plan);
			sweep([...natives.keys()]);
		},
		silence() {
			due = new Set();
		},
		sizes() {
			let detectorCount = 0;
			for (const list of detectors.values()) detectorCount += list.length;
			return { detectors: detectorCount, ids: natives.size };
		},
	};
}
