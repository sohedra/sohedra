// Checked by `pnpm check`, not run. A gesture's element is the main thread's one element type, as a
// ref, a main-thread event and a query have it; a gesture of either entry is what
// `main-thread:gesture` takes, and a plain object is none.

import { mainThreadRef } from "@sohedra/lynx";
import type { LynxElementAttributes, MainThread } from "@sohedra/lynx/elements";
import { FlingGesture } from "@sohedra/lynx/experimental";
import { PanGesture } from "@sohedra/lynx/gesture";
import type { Gesture } from "@sohedra/lynx/gesture";

const box = mainThreadRef<MainThread.Element | null>(null);

const pan = new PanGesture({
	onUpdate(event) {
		"main thread";
		box.current = event.currentTarget;
		const element: MainThread.Element = event.target;
		const animation: MainThread.Animation = element.animate([{ opacity: 0 }], 200);
		const id: string = animation.id;
		const inside: boolean = event.currentTarget.contains(box.current);
		void [id, inside];
	},
});

const gestures: LynxElementAttributes["main-thread:gesture"][] = [pan, new FlingGesture({})];

// @ts-expect-error a plain object is no gesture, whatever it holds.
const plain: Gesture = { __isSerialized: true };

void [gestures, plain];
