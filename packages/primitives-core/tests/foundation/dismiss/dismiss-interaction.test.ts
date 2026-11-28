// DismissInteraction: one popup's dismissal by Escape and an outside press of either press type, driven by plain calls as a platform without a document makes them, in a tree
// of nested popups too.
import { describe, expect, it, vi } from "vitest";

import type { DismissView } from "../../../src/foundation/dismiss/dismiss-interaction.js";
import { LONG_TOUCH_MS } from "../../../src/foundation/dismiss/dismiss-rules.js";
import {
	type DismissChangeDetails,
	DismissInteraction,
	type DismissInteractionProps,
	type OutsidePress,
} from "../../../src/foundation/dismiss/index.js";
import { FloatingTree } from "../../../src/foundation/popup/index.js";
import { createFakePlatform, type FakeTypes } from "../../kit/kit-fake-platform.js";

const EVENT = {} as never;

function setup(options: DismissInteractionProps = {}, tree: FloatingTree | null = null) {
	const platform = createFakePlatform();
	const view: DismissView<FakeTypes> = {
		open: true,
		tree,
		nodeId: "popup",
		platform,
	};
	const live = { ...options };
	const reasons: string[] = [];
	let onClose: ((details: DismissChangeDetails<FakeTypes>) => void) | undefined;
	const dismiss = new DismissInteraction<FakeTypes>(() => live, {
		popup: view,
		close: (details) => {
			reasons.push(details.reason);
			onClose?.(details);
		},
	});
	return {
		dismiss,
		view: view as { -readonly [Key in keyof DismissView<FakeTypes>]: DismissView<FakeTypes>[Key] },
		scheduler: platform.scheduler,
		reasons,
		options: live as {
			-readonly [Key in keyof DismissInteractionProps]: DismissInteractionProps[Key];
		},
		whenClosing(callback: (details: DismissChangeDetails<FakeTypes>) => void) {
			onClose = callback;
		},
	};
}

/** A popup as a node of the tree of nested popups reads it. */
function treeContext(fields: { outsidePress?: boolean } = {}) {
	return {
		open: true,
		floatingElement: null,
		anchorElement: null,
		dismissBubbles: { escapeKey: false, outsidePress: fields.outsidePress ?? true },
	};
}

/** A press as a platform reports it; the fields left out are an outside press with a pointer. */
function press(fields: Partial<OutsidePress<FakeTypes>> = {}): OutsidePress<FakeTypes> {
	return {
		event: EVENT,
		eventType: undefined,
		inOwnElements: false,
		pressBacked: true,
		spared: false,
		...fields,
	};
}

describe("DismissInteraction", () => {
	describe("Escape", () => {
		it("closes and tells the platform to prevent and stop the event", () => {
			const { dismiss, reasons } = setup();
			expect(dismiss.escape(EVENT)).toEqual({ preventDefault: true, stopPropagation: true });
			expect(reasons).toEqual(["escape-key"]);
		});

		it("leaves the event alone when the close is cancelled or allowed to propagate", () => {
			const canceled = setup();
			canceled.whenClosing((details) => details.cancel());
			expect(canceled.dismiss.escape(EVENT)).toEqual({
				preventDefault: false,
				stopPropagation: true,
			});

			const propagating = setup();
			propagating.whenClosing((details) => details.allowPropagation());
			expect(propagating.dismiss.escape(EVENT)).toEqual({
				preventDefault: true,
				stopPropagation: false,
			});
		});

		it("does nothing while closed, while disabled or during a text composition", () => {
			const closed = setup();
			closed.view.open = false;
			expect(closed.dismiss.escape(EVENT)).toBeNull();

			const disabled = setup({ enabled: false });
			expect(disabled.dismiss.escape(EVENT)).toBeNull();

			const composing = setup();
			expect(composing.dismiss.escape(EVENT, true)).toBeNull();
			// The key that ends a composition may arrive after its end: it still isn't the popup's.
			composing.dismiss.compositionEnd(5);
			expect(composing.dismiss.escape(EVENT)).toBeNull();
			composing.scheduler.advance(5);
			expect(composing.dismiss.escape(EVENT)).not.toBeNull();
			expect(closed.reasons.concat(disabled.reasons)).toEqual([]);
		});

		it("leaves Escape to an open child that doesn't let it bubble", () => {
			const tree = new FloatingTree();
			const { dismiss } = setup({}, tree);
			tree.addNode({ id: "popup", parentId: null, context: treeContext() });
			const child = treeContext();
			tree.addNode({ id: "child", parentId: "popup", context: child });
			expect(dismiss.escape(EVENT)).toBeNull();
			child.open = false;
			expect(dismiss.escape(EVENT)).not.toBeNull();
		});
	});

	describe("a sloppy outside press", () => {
		it("closes on the press's start and not on its click", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "sloppy" });
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.press(press({ eventType: "click" }));
			expect(reasons).toEqual([]);
			dismiss.pointerPress(press(), false);
			expect(reasons).toEqual(["outside-press"]);
		});

		it("doesn't close for a press on its own elements, a spared one or a finger's", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "sloppy" });
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.pointerPress(press({ inOwnElements: true }), false);
			dismiss.pointerPress(press({ spared: true }), false);
			// A finger's press is followed as a touch instead.
			dismiss.pointerPress(press(), true);
			expect(reasons).toEqual([]);
		});

		it("follows a touch: its end dismisses once it moved, a far move at once", () => {
			const moved = setup({ outsidePressEvent: "sloppy" });
			moved.dismiss.touchSeen();
			moved.dismiss.touchStart({ x: 10, y: 10 }, false);
			moved.dismiss.touchMove({ x: 17, y: 10 }, press());
			expect(moved.reasons).toEqual([]);
			moved.dismiss.touchEnd(press());
			expect(moved.reasons).toEqual(["outside-press"]);

			const scrolled = setup({ outsidePressEvent: "sloppy" });
			scrolled.dismiss.touchSeen();
			scrolled.dismiss.touchStart({ x: 10, y: 10 }, false);
			scrolled.dismiss.touchMove({ x: 10, y: 30 }, press());
			expect(scrolled.reasons).toEqual(["outside-press"]);

			const still = setup({ outsidePressEvent: "sloppy" });
			still.dismiss.touchSeen();
			still.dismiss.touchStart({ x: 10, y: 10 }, false);
			still.dismiss.touchEnd(press());
			expect(still.reasons).toEqual([]);
		});

		it("drops the mouse press of a touch that lasted too long", () => {
			const { dismiss, scheduler } = setup({ outsidePressEvent: "sloppy" });
			dismiss.touchSeen();
			dismiss.touchStart({ x: 10, y: 10 }, false);
			expect(dismiss.pressSeen({ button: 0, compatibility: true })).toBe(true);

			dismiss.touchStart({ x: 10, y: 10 }, false);
			scheduler.advance(LONG_TOUCH_MS);
			expect(dismiss.pressSeen({ button: 0, compatibility: true })).toBe(false);
		});
	});

	describe("an intentional outside press", () => {
		it("closes on the click of a press seen while open, not on its start", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "intentional" });
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.pointerPress(press(), false);
			dismiss.press(press({ eventType: "mousedown" }));
			expect(reasons).toEqual([]);
			dismiss.press(press({ eventType: "click" }));
			expect(reasons).toEqual(["outside-press"]);
		});

		it("ignores the click of a press that began before the popup opened, until a new press", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "intentional" });
			dismiss.press(press({ eventType: "click" }));
			expect(reasons).toEqual([]);
			// A click with no press behind it (the keyboard, assistive technology) is its own press.
			dismiss.press(press({ eventType: "click", pressBacked: false }));
			expect(reasons).toEqual(["outside-press"]);

			// A close in between ends the session: the press seen before it no longer counts.
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.closed();
			dismiss.press(press({ eventType: "click" }));
			expect(reasons).toEqual(["outside-press"]);
		});

		it("doesn't take a press that passed through the popup for an outside press", () => {
			const { dismiss, reasons, scheduler } = setup({ outsidePressEvent: "intentional" });
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.markInside();
			expect(dismiss.insideTree).toBe(true);
			dismiss.press(press({ eventType: "click" }));
			expect(reasons).toEqual([]);
			expect(dismiss.insideTree).toBe(false);

			// Left alone, the mark lasts until the next task.
			dismiss.markInside();
			scheduler.advance(0);
			expect(dismiss.insideTree).toBe(false);
		});

		it("absorbs one outside click after a press that was dragged out of the popup", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "intentional" });
			dismiss.pressStart(0, true);
			dismiss.pressEnd({ canceled: false, endedInTree: false });
			dismiss.press(press({ eventType: "click", pressBacked: false }));
			expect(reasons).toEqual([]);
			dismiss.press(press({ eventType: "click", pressBacked: false }));
			expect(reasons).toEqual(["outside-press"]);
		});

		it("absorbs only an immediate click when the press's start was prevented", () => {
			const { dismiss, reasons, scheduler } = setup({ outsidePressEvent: "intentional" });
			dismiss.pressStart(0, true);
			dismiss.pressStartPrevented();
			dismiss.pressEnd({ canceled: false, endedInTree: false });
			dismiss.press(press({ eventType: "click", pressBacked: false }));
			expect(reasons).toEqual([]);

			dismiss.pressStart(0, true);
			dismiss.pressStartPrevented();
			dismiss.pressEnd({ canceled: true, endedInTree: false });
			scheduler.advance(0);
			dismiss.press(press({ eventType: "click", pressBacked: false }));
			expect(reasons).toEqual(["outside-press"]);
		});

		it("asks where the press landed only when it would otherwise dismiss", () => {
			const { dismiss, reasons } = setup({ outsidePressEvent: "intentional" });
			const spared = vi.fn(() => true);
			const report = (eventType: "click" | "mousedown") =>
				({
					event: EVENT,
					eventType,
					inOwnElements: false,
					pressBacked: true,
					get spared() {
						return spared();
					},
				}) satisfies OutsidePress<FakeTypes>;
			dismiss.pressSeen({ button: 0, pointerType: "mouse" });
			dismiss.press(report("mousedown"));
			expect(spared).not.toHaveBeenCalled();
			dismiss.press(report("click"));
			expect(spared).toHaveBeenCalledTimes(1);
			expect(reasons).toEqual([]);
		});
	});

	it("leaves an outside press to an open child that doesn't let it bubble", () => {
		const tree = new FloatingTree();
		const { dismiss, reasons } = setup({ outsidePressEvent: "sloppy" }, tree);
		tree.addNode({ id: "popup", parentId: null, context: treeContext() });
		const child = treeContext({ outsidePress: false });
		tree.addNode({ id: "child", parentId: "popup", context: child });
		dismiss.pressSeen({ button: 0, pointerType: "mouse" });
		dismiss.pointerPress(press(), false);
		expect(reasons).toEqual([]);
		child.dismissBubbles.outsidePress = true;
		dismiss.pointerPress(press(), false);
		expect(reasons).toEqual(["outside-press"]);
	});

	it("marks the popups it is nested in when a press passes through it", () => {
		const tree = new FloatingTree();
		const { dismiss, scheduler } = setup({}, tree);
		const parent = treeContext();
		tree.addNode({ id: "parent", parentId: null, context: parent });
		tree.addNode({ id: "popup", parentId: "parent", context: treeContext() });
		dismiss.markInside();
		expect(tree.isInside("parent")).toBe(true);
		scheduler.advance(0);
		expect(tree.isInside("parent")).toBe(false);
	});

	describe("a whole press, from a platform that reports a press as one event", () => {
		it("closes for an outside press under either press type", () => {
			const sloppy = setup({ outsidePressEvent: "sloppy" });
			sloppy.dismiss.wholePress(press(), "touch");
			expect(sloppy.reasons).toEqual(["outside-press"]);

			const intentional = setup({ outsidePressEvent: "intentional" });
			intentional.dismiss.wholePress(press(), "touch");
			expect(intentional.reasons).toEqual(["outside-press"]);
		});

		it("records the pointer that made it", () => {
			const { dismiss } = setup({ outsidePressEvent: { mouse: "intentional", touch: "sloppy" } });
			dismiss.wholePress(press({ inOwnElements: true }), "touch");
			expect(dismiss.pressType).toBe("sloppy");
		});

		it("does nothing for a press in the popup's own elements or where one never dismisses", () => {
			const { dismiss, reasons } = setup();
			dismiss.wholePress(press({ inOwnElements: true }), "touch");
			dismiss.wholePress(press({ spared: true }), "touch");
			expect(reasons).toEqual([]);
		});

		it("does nothing while the popup is closed or its dismissal is off", () => {
			const closed = setup();
			closed.view.open = false;
			closed.dismiss.wholePress(press(), "touch");
			expect(closed.reasons).toEqual([]);

			const off = setup({ enabled: false });
			off.dismiss.wholePress(press(), "touch");
			expect(off.reasons).toEqual([]);
		});

		it("leaves a press that passed through the popup alone, and forgets it", () => {
			const { dismiss, reasons } = setup();
			dismiss.markInside();
			dismiss.wholePress(press(), "touch");
			expect(reasons).toEqual([]);
			expect(dismiss.insideTree).toBe(false);
		});

		it("waits for an open child that keeps outside presses to itself", () => {
			const tree = new FloatingTree();
			const { dismiss, reasons } = setup({}, tree);
			tree.addNode({ id: "popup", parentId: null, context: treeContext() });
			tree.addNode({
				id: "child",
				parentId: "popup",
				context: treeContext({ outsidePress: false }),
			});
			dismiss.wholePress(press(), "touch");
			expect(reasons).toEqual([]);
		});
	});
});
