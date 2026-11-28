// Behaviours of Presence. Frames come from the fake platform's scheduler, which the test steps.

import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Presence } from "../../../src/foundation/presence/index.js";
import type { PresenceProps } from "../../../src/foundation/presence/presence.svelte.js";
import { createFakePlatform, type FakeScheduler } from "../../kit/kit-fake-platform.js";

let scheduler: FakeScheduler;

type MutableProps = { -readonly [K in keyof PresenceProps]: PresenceProps[K] };

const roots: (() => void)[] = [];

function setup(initial: MutableProps) {
	const props = $state<MutableProps>(initial);
	const presence = new Presence(props, scheduler);
	roots.push($effect.root(() => presence.connect()));
	flushSync();
	return { props, presence };
}

const snapshot = (presence: Presence) => ({
	mounted: presence.mounted,
	status: presence.transitionStatus,
});

beforeEach(() => {
	scheduler = createFakePlatform().scheduler;
});

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

describe("Presence", () => {
	it("starts unmounted when closed", () => {
		const { presence } = setup({ open: false });
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
		expect(presence.open).toBe(false);
	});

	it("does not request a frame for an element that mounts already open", () => {
		const { presence } = setup({ open: true });
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
		expect(scheduler.pending.frames).toBe(0);
	});

	it("is starting for one frame after opening", () => {
		const { props, presence } = setup({ open: false });
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
		const { props, presence } = setup({ open: true });
		props.open = false;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
		presence.complete();
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
	});

	it("ignores complete() while open", () => {
		const { props, presence } = setup({ open: false });
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
		const { props, presence } = setup({ open: true });
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
		const { props, presence } = setup({ open: false });
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
		const { props, presence } = setup({ open: true });
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
		const { presence } = setup({ open: true, animateInitialOpen: true });
		expect(snapshot(presence)).toEqual({ mounted: true, status: "starting" });
		scheduler.runFrames();
		expect(snapshot(presence)).toEqual({ mounted: true, status: undefined });
	});

	it("ignores animateInitialOpen for an element that starts closed", () => {
		const { presence } = setup({ open: false, animateInitialOpen: true });
		expect(snapshot(presence)).toEqual({ mounted: false, status: undefined });
		expect(scheduler.pending.frames).toBe(0);
	});

	it("re-derives status for a reader effect", () => {
		const { props, presence } = setup({ open: false });
		const seen: string[] = [];
		roots.push(
			$effect.root(() => {
				$effect(() => {
					seen.push(`${presence.mounted}:${presence.transitionStatus ?? "none"}`);
				});
			}),
		);
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
});

describe("Presence: idle state and deferred ending (enableIdleState, deferEndingState)", () => {
	it("starts idle when open on the first render", () => {
		const { presence } = setup({ open: true, enableIdleState: true });
		expect(snapshot(presence)).toEqual({ mounted: true, status: "idle" });
		expect(scheduler.pending.frames).toBe(0);
	});

	it("settles on idle one frame after opening, and restarts when reopened while ending", () => {
		const { props, presence } = setup({ open: false, enableIdleState: true });
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
		const { props, presence } = setup({ open: true, deferEndingState: true });
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
		const { props, presence } = setup({ open: true, deferEndingState: true });
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
			const { props, presence } = setup({ open: false });
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

describe("Presence: reads in an effect teardown", () => {
	// Svelte re-runs a derived read in an effect teardown with the values from before the flush. A
	// phase that kept its memory in plain fields rewound it there, so the close below never
	// unmounted, or a reopen didn't mount.
	it("closes, unmounts and reopens when a teardown reads `mounted`", () => {
		const { props, presence } = setup({ open: true });
		const seen: boolean[] = [];
		roots.push(
			$effect.root(() => {
				$effect(() => {
					void props.open;
					void presence.mounted;
					return () => {
						seen.push(presence.mounted);
					};
				});
			}),
		);
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

describe("Presence: open changing before connect()", () => {
	it("commits the phase `open` moved to before connect(), so a later close ends", () => {
		const props = $state<MutableProps>({ open: false });
		const presence = new Presence(props, scheduler);
		props.open = true;
		roots.push($effect.root(() => presence.connect()));
		flushSync();
		props.open = false;
		flushSync();
		expect(snapshot(presence)).toEqual({ mounted: true, status: "ending" });
	});
});
