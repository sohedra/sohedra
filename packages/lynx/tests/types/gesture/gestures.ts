// Checked by `pnpm check`, not run. A gesture is made from one options object, only the gesture
// classes make one, and how it crosses stays hidden. The two calls of the state manager no device
// has shown working are reached through the experimental type.

import { ExclusiveGesture, LongPressGesture } from "@sohedra/lynx/experimental";
import type { ExperimentalStateManager } from "@sohedra/lynx/experimental";
import { DefaultScrollGesture, PanGesture, TapGesture } from "@sohedra/lynx/gesture";
import type { GestureKind, PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

const onUpdate = (event: PanGestureChangeEvent, state: StateManager): void => {
	const x: number = event.params.x;
	const atStart: boolean = event.params.isAtStart;
	const time: number = event.timestamp;
	event.currentTarget.setStyleProperty("transform", `translateX(${x}px)`);
	state.active();
	(state as ExperimentalStateManager).consumeGesture(atStart);
	void time;
};

const scroll = new DefaultScrollGesture({ tapSlop: 2 });
const pan: GestureKind = new PanGesture({ minDistance: 4, onUpdate, waitFor: [scroll] });
const composed: GestureKind = new ExclusiveGesture(pan, new TapGesture(), new LongPressGesture());
void composed;

// @ts-expect-error the pan reads no other distance.
void new PanGesture({ activeOffsetX: 10 });
// @ts-expect-error the engine reads no `enabled`.
void new TapGesture({ enabled: false });
// @ts-expect-error a plain object is not a gesture.
const plain: GestureKind = { type: 0 };
// @ts-expect-error the stable state manager has no consumeGesture.
void ((state: StateManager) => state.consumeGesture(true));
// @ts-expect-error how a gesture crosses is not part of its type.
void pan.callbacks;
void plain;
