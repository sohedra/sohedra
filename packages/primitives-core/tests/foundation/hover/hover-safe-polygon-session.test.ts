// SafePolygonSession: one hover-out's safe polygon at work, move by move.
import { describe, expect, it, vi } from "vitest";

import { SafePolygon } from "../../../src/foundation/hover/hover-safe-polygon.js";
import { SafePolygonSession } from "../../../src/foundation/hover/index.js";
import { box } from "../../kit/kit-geometry.js";
import { createPopover } from "../../kit/kit-popover.svelte.js";

describe("SafePolygonSession", () => {
	// Trigger at 100,100 (100×20); popup below it at 50,130 (200×100), a 10px gap.
	// Inside the triangle towards the popup, not landed yet: a close-soon.
	const towardsPopup = {
		clientX: 95,
		clientY: 128,
		isLeave: false,
		isOverFloating: false,
		isOverReference: false,
		leavingIntoFloating: false,
		measure: () => ({ reference: box(100, 100, 100, 20), floating: box(50, 130, 200, 100) }),
	};

	it("closes 40ms after a close-soon move unless another move arrives", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const session = new SafePolygonSession({
			polygon: new SafePolygon("bottom", 150, 121, 0),
			popup: store,
			close: onClose,
		});
		session.move(towardsPopup);
		scheduler.advance(39);
		expect(onClose).not.toHaveBeenCalled();
		scheduler.advance(1);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("drops a pending close-soon on a move it can't measure", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const session = new SafePolygonSession({
			polygon: new SafePolygon("bottom", 150, 121, 0),
			popup: store,
			close: onClose,
		});
		session.move(towardsPopup);
		// The trigger or popup is gone: the handler clears its timer before bailing out.
		session.move(null);
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("drops a pending close-soon when the hover state clears its tracker", () => {
		const { store, scheduler } = createPopover();
		const onClose = vi.fn();
		const removeListener = vi.fn();
		const session = new SafePolygonSession({
			polygon: new SafePolygon("bottom", 150, 121, 0),
			popup: store,
			close: onClose,
		});
		store.hover.setCloseTracker({
			handler: () => {},
			stop() {
				removeListener();
				session.stop();
			},
		});
		session.move(towardsPopup);
		store.hover.clearCloseTracker();
		scheduler.advance(100);
		expect(removeListener).toHaveBeenCalledOnce();
		expect(onClose).not.toHaveBeenCalled();
		expect(store.hover.handler).toBeUndefined();
	});

	it("stays open while a nested popup is open", () => {
		const { store, tree, scheduler } = createPopover();
		store.joinFloatingTree("parent", null);
		tree.addNode({
			id: "child",
			parentId: "parent",
			context: {
				open: true,
				floatingElement: null,
				anchorElement: null,
				dismissBubbles: { escapeKey: false, outsidePress: true },
			},
		});
		expect(tree.children("parent")).toHaveLength(1);
		const onClose = vi.fn();
		const session = new SafePolygonSession({
			polygon: new SafePolygon("bottom", 150, 121, 0),
			popup: store,
			close: onClose,
		});
		session.move({ ...towardsPopup, clientY: 50 });
		scheduler.advance(100);
		expect(onClose).not.toHaveBeenCalled();
	});
});
