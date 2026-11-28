// createChangeEventDetails: what a change carries, and the cancel and propagation it records.
import { describe, expect, it } from "vitest";

import { createChangeEventDetails, REASONS } from "../../../src/foundation/kernel/index.js";

// Core runs without a DOM: the event is whatever the platform passes in.
const event = { type: "click" } as unknown as Event;

describe("createChangeEventDetails", () => {
	it("carries the reason, event, trigger and custom properties", () => {
		const trigger = {} as Element;
		const details = createChangeEventDetails(REASONS.triggerPress, event as MouseEvent, trigger, {
			preventUnmountOnClose: 1,
		});
		expect(details.reason).toBe("trigger-press");
		expect(details.event).toBe(event);
		expect(details.trigger).toBe(trigger);
		expect(details.preventUnmountOnClose).toBe(1);
	});

	it("starts neither canceled nor propagating, and records cancel() and allowPropagation()", () => {
		const details = createChangeEventDetails(REASONS.none, event);
		expect(details.isCanceled).toBe(false);
		expect(details.isPropagationAllowed).toBe(false);
		details.cancel();
		details.allowPropagation();
		expect(details.isCanceled).toBe(true);
		expect(details.isPropagationAllowed).toBe(true);
	});
});
