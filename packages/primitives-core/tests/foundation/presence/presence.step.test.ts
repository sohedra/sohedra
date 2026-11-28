// `step()`: the pure transition behind `Presence`, from a committed phase to the current `open`.

import { describe, expect, it } from "vitest";

import { type PresencePhase, step } from "../../../src/foundation/presence/presence.svelte.js";

const plain = { idle: false, defer: false };
const idle = { idle: true, defer: false };
const defer = { idle: false, defer: true };

const phase = (open: boolean, mounted: boolean, status?: PresencePhase["status"]) => ({
	open,
	mounted,
	status,
});

describe("step", () => {
	it("returns the committed phase itself while `open` is unchanged", () => {
		const committed = phase(true, true, "starting");
		expect(step(committed, true, plain)).toBe(committed);
		const closed = phase(false, true, "ending");
		expect(step(closed, false, plain)).toBe(closed);
	});

	it("mounts with 'starting' when opened from unmounted", () => {
		expect(step(phase(false, false), true, plain)).toEqual(phase(true, true, "starting"));
	});

	it("keeps the status when reopened while still mounted", () => {
		expect(step(phase(false, true, "ending"), true, plain)).toEqual(phase(true, true, "ending"));
		expect(step(phase(false, true), true, plain)).toEqual(phase(true, true, undefined));
	});

	it("restarts a reopened element that isn't idle, with enableIdleState", () => {
		expect(step(phase(false, true, "ending"), true, idle)).toEqual(phase(true, true, "starting"));
		expect(step(phase(false, true, "idle"), true, idle)).toEqual(phase(true, true, "idle"));
	});

	it("stays mounted with 'ending' when closed", () => {
		expect(step(phase(true, true), false, plain)).toEqual(phase(false, true, "ending"));
		expect(step(phase(true, true, "starting"), false, plain)).toEqual(phase(false, true, "ending"));
	});

	it("keeps the status when closed with deferEndingState (the frame enters 'ending')", () => {
		expect(step(phase(true, true), false, defer)).toEqual(phase(false, true, undefined));
		expect(step(phase(true, true, "starting"), false, defer)).toEqual(
			phase(false, true, "starting"),
		);
	});

	it("stays unmounted when closed while unmounted, dropping a stale 'ending'", () => {
		expect(step(phase(true, false, "ending"), false, plain)).toEqual(phase(false, false));
		expect(step(phase(true, false), false, plain)).toEqual(phase(false, false));
	});

	it("is a fixed point: stepping its own result changes nothing", () => {
		const committed = phase(false, false);
		const next = step(committed, true, plain);
		expect(step(next, true, plain)).toBe(next);
	});
});
