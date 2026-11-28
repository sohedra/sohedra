import type { TransitionStatus } from "@sohedra/primitives-core/foundation/presence/index.js";
import { flushSync } from "svelte";

import { type StateAttributesMapping, webScheduler } from "../kernel/index.js";

declare global {
	/** Set to `true` to skip waiting for animations (for example in tests). */
	var SOHEDRA_ANIMATIONS_DISABLED: boolean | undefined;
}

/** The data attributes of a part's enter and exit transitions. */
const TransitionStatusDataAttributes = {
	/** Present when the component begins animating in. */
	startingStyle: "data-starting-style",
	/** Present when the component is animating out. */
	endingStyle: "data-ending-style",
} as const;

const STARTING = { [TransitionStatusDataAttributes.startingStyle]: "" };
const ENDING = { [TransitionStatusDataAttributes.endingStyle]: "" };

/** `transitionStatus` → `data-starting-style` / `data-ending-style`. */
export const transitionStatusMapping = {
	transitionStatus(value: TransitionStatus): Record<string, string> | null {
		if (value === "starting") {
			return STARTING;
		}
		if (value === "ending") {
			return ENDING;
		}
		return null;
	},
} satisfies StateAttributesMapping<{ transitionStatus: TransitionStatus }>;

/** Animations excluding infinite ones, whose `finished` promises never resolve while they run. */
function getFiniteAnimations(element: Element): Animation[] {
	return element.getAnimations().filter((animation) => {
		const timing = animation.effect?.getTiming();
		return timing?.duration !== Infinity && timing?.iterations !== Infinity;
	});
}

export interface WaitForAnimationsOptions {
	/** Waits for `[data-starting-style]` to be removed first (an opening element). */
	waitForStartingStyleRemoved?: boolean | undefined;
	/** Aborts the wait. */
	signal: AbortSignal;
}

/**
 * Calls `callback` once every finite animation on `element` has finished (one frame after the
 * call at the earliest, so animations can start), then flushes so the browser doesn't paint the
 * intermediate state. A canceled animation waits for its replacements.
 */
export function waitForAnimations(
	element: HTMLElement,
	options: WaitForAnimationsOptions,
	callback: () => void,
): void {
	const { signal } = options;
	if (typeof element.getAnimations !== "function" || globalThis.SOHEDRA_ANIMATIONS_DISABLED) {
		callback();
		return;
	}

	const done = () => {
		callback();
		flushSync();
	};

	const exec = () => {
		// Discard fulfilled Animation values so unfinished animations cannot retain their targets.
		Promise.all(
			getFiniteAnimations(element).map((animation) => animation.finished.then(noop)),
		).then(
			() => {
				if (!signal.aborted) {
					done();
				}
			},
			() => {
				if (signal.aborted) {
					return;
				}
				const current = getFiniteAnimations(element);
				if (current.some((animation) => animation.pending || animation.playState !== "finished")) {
					// An animation was aborted because a property it depends on changed: wait for any
					// replacement animations.
					exec();
					return;
				}
				done();
			},
		);
	};

	const nextFrame = () => {
		const cancel = webScheduler.frame(exec);
		signal.addEventListener("abort", cancel, { once: true });
	};

	if (options.waitForStartingStyleRemoved) {
		const attribute = TransitionStatusDataAttributes.startingStyle;
		// Without `[data-starting-style]`, wait a frame so open animations can register.
		if (!element.hasAttribute(attribute)) {
			nextFrame();
			return;
		}
		const observer = new MutationObserver(() => {
			if (!element.hasAttribute(attribute)) {
				observer.disconnect();
				exec();
			}
		});
		observer.observe(element, { attributes: true, attributeFilter: [attribute] });
		signal.addEventListener("abort", () => observer.disconnect(), { once: true });
		return;
	}

	nextFrame();
}

function noop() {}

/** `transition: none` while a popup is starting, so it doesn't animate from its default styles. */
export const DISABLED_TRANSITIONS_STYLE = "transition: none";
