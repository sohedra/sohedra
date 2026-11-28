// Presence: mounting, the starting and ending statuses with their frames, complete(), the idle
// state and the deferred ending, reads in an effect teardown, and `step()`, the pure transition
// from a committed phase to the current `open`. Frames come from the fake platform's scheduler,
// which the test steps.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { Presence } from "../../../src/foundation/presence/index.js";
import {
	type PresencePhase,
	type PresenceProps,
	step,
} from "../../../src/foundation/presence/presence.svelte.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { createFakePlatform } from "../../kit/kit-fake-platform.js";

type MutableProps = { -readonly [K in keyof PresenceProps]: PresenceProps[K] };

function setup(initial: MutableProps) {
	const props = $state<MutableProps>(initial);
	const { scheduler } = createFakePlatform();
	const presence = new Presence(props, scheduler);
	root(() => presence.connect());
	flushSync();
	return { props, presence, scheduler };
}

const snapshot = (presence: Presence) => ({
	mounted: presence.mounted,
	status: presence.transitionStatus,
});

describe("Presence", () => {
	it("starts unmounted when closed", () => {
		const { presence } = setup({ open: false });
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
		expect(presence.open).toBe(false);
	});

	it("does not request a frame for an element that mounts already open", () => {
		const { presence, scheduler } = setup({ open: true });
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
		expect(scheduler.pending.frames).toBe(0);
	});

	it("is starting for one frame after opening", () => {
		const { props, presence, scheduler } = setup({ open: false });
		props.open = true;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
		expect(scheduler.pending.frames).toBe(1);
		expect(presence.transitionStatus).toBe("starting");
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
		flushSync();
		expect(scheduler.pending.frames).toBe(0);
	});

	it("is ending and stays mounted until complete()", () => {
		const { props, presence, scheduler } = setup({ open: true });
		props.open = false;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		presence.complete();
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
	});

	it("ignores complete() while open", () => {
		const { props, presence, scheduler } = setup({ open: false });
		props.open = true;
		flushSync();
		presence.complete();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
		scheduler.runFrames();
		presence.complete();
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
	});

	it("ignores complete() while closed and unmounted", () => {
		const { presence } = setup({ open: false });
		presence.complete();
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
	});

	it("clears a stale ending status when reopened before the exit settles", () => {
		const { props, presence, scheduler } = setup({ open: true });
		props.open = false;
		flushSync();
		expect(presence.transitionStatus).toBe("ending");
		props.open = true;
		flushSync();
		// Still mounted: no remount, and the status clears on the next frame.
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		expect(scheduler.pending.frames).toBe(1);
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
		// A late completion of the canceled exit doesn't unmount the reopened element.
		presence.complete();
		expect(presence.mounted).toBe(true);
	});

	it("goes to ending when closed while starting, and cancels the frame", () => {
		const { props, presence, scheduler } = setup({ open: false });
		props.open = true;
		flushSync();
		props.open = false;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		expect(scheduler.pending.frames).toBe(0);
		scheduler.runFrames();
		expect(presence.transitionStatus).toBe("ending");
	});

	it("starts again after a completed exit", () => {
		const { props, presence, scheduler } = setup({ open: true });
		props.open = false;
		flushSync();
		presence.complete();
		props.open = true;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
		scheduler.runFrames();
		expect(presence.transitionStatus).toBeUndefined();
	});

	it("goes through starting on the first render with animateInitialOpen", () => {
		const { presence, scheduler } = setup({ open: true, animateInitialOpen: true });
		expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
	});

	it("ignores animateInitialOpen for an element that starts closed", () => {
		const { presence, scheduler } = setup({ open: false, animateInitialOpen: true });
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
		expect(scheduler.pending.frames).toBe(0);
	});

	it("re-derives status for a reader effect", () => {
		const { props, presence, scheduler } = setup({ open: false });
		const seen: string[] = [];
		root(() => {
			$effect(() => {
				seen.push(`${presence.mounted}:${presence.transitionStatus ?? "none"}`);
			});
		});
		flushSync();
		props.open = true;
		flushSync();
		scheduler.runFrames();
		flushSync();
		props.open = false;
		flushSync();
		presence.complete();
		flushSync();
		expect(seen).toEqual(["false:none", "true:starting", "true:none", "true:ending", "false:none"]);
	});

	describe("with enableIdleState and deferEndingState", () => {
		it("starts idle when open on the first render", () => {
			const { presence, scheduler } = setup({ open: true, enableIdleState: true });
			expect(snapshot(presence)).toEqual({ mounted: true, status: "idle" });
			expect(scheduler.pending.frames).toBe(0);
		});

		it("settles on idle one frame after opening, and restarts when reopened while ending", () => {
			const { props, presence, scheduler } = setup({ open: false, enableIdleState: true });
			props.open = true;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
			scheduler.runFrames();
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "idle" });
			props.open = false;
			flushSync();
			expect(presence.transitionStatus).toBe("ending");
			props.open = true;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
			scheduler.runFrames();
			expect(presence.transitionStatus).toBe("idle");
		});

		it("enters ending one frame after closing with deferEndingState", () => {
			const { props, presence, scheduler } = setup({ open: true, deferEndingState: true });
			props.open = false;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
			scheduler.runFrames();
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
			presence.complete();
			expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
		});

		it("cancels the deferred ending when reopened within the frame", () => {
			const { props, presence, scheduler } = setup({ open: true, deferEndingState: true });
			props.open = false;
			flushSync();
			props.open = true;
			flushSync();
			scheduler.runFrames();
			expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
		});

		it("reports whether complete() unmounted", () => {
			const { props, presence } = setup({ open: true });
			expect(presence.complete()).toBe(false);
			props.open = false;
			flushSync();
			expect(presence.complete()).toBe(true);
			expect(presence.complete()).toBe(false);
		});

		describe("mountShown", () => {
			it("opens an element mounted as shown without 'starting' or a frame", () => {
				const { props, presence, scheduler } = setup({ open: false });
				presence.mountShown();
				props.open = true;
				flushSync();
				expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
				expect(scheduler.pending.frames).toBe(0);
			});

			it("keeps the status of an element that is already mounted", () => {
				const { props, presence } = setup({ open: false });
				props.open = true;
				flushSync();
				presence.mountShown();
				expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
			});

			it("leaves later opens animating in once it closed and unmounted", () => {
				const { props, presence } = setup({ open: false });
				presence.mountShown();
				props.open = true;
				flushSync();
				props.open = false;
				flushSync();
				expect(presence.transitionStatus).toBe("ending");
				presence.complete();
				props.open = true;
				flushSync();
				expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
			});
		});
	});

	describe("read in an effect teardown", () => {
		// Svelte re-runs a derived read in an effect teardown with the values from before the flush. A
		// phase that kept its memory in plain fields rewound it there, so the close below never
		// unmounted, or a reopen didn't mount.
		it("closes, unmounts and reopens when a teardown reads `mounted`", () => {
			const { props, presence } = setup({ open: true });
			const seen: boolean[] = [];
			root(() => {
				$effect(() => {
					void props.open;
					void presence.mounted;
					return () => {
						seen.push(presence.mounted);
					};
				});
			});
			flushSync();
			props.open = false;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
			expect(presence.complete()).toBe(true);
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
			props.open = true;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
			expect(seen.length).toBeGreaterThan(0);
		});
	});

	describe("when open changes before connect()", () => {
		it("commits the phase `open` moved to before connect(), so a later close ends", () => {
			const props = $state<MutableProps>({ open: false });
			const { scheduler } = createFakePlatform();
			const presence = new Presence(props, scheduler);
			props.open = true;
			root(() => presence.connect());
			flushSync();
			props.open = false;
			flushSync();
			expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		});
	});
});

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
