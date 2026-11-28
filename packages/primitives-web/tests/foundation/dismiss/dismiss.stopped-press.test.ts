// New cases: a press that something else stops before it reaches its target. The dismissal sees
// every press at the document and follows it to its target, where it decides. A drag library
// that swallows the click after a drag stops it on the way, so it never arrives: what was waiting
// for it at the target must not act on a later click instead, with the stopped one's stale data.
// - The popup is the initially open Popover of the other dismiss cases
//   (fixtures/dismiss-popover.svelte): `floating` is its popup and `input` a field in it. Its
//   mouse outside press is `intentional`, so it dismisses on `click`.

import { REASONS } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PopoverRootChangeEventDetails } from "#lib/components/popover/popover-types.js";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import DismissPopover from "./fixtures/dismiss-popover.svelte";

const flushMicrotasks = () => act(async () => {});

const floating = () => screen.queryByTestId("floating");

type OpenChange = [open: boolean, details: PopoverRootChangeEventDetails];

describe("a press stopped before it reaches its target", () => {
	const { render } = createRenderer();

	let removeStopper: (() => void) | undefined;

	afterEach(() => {
		removeStopper?.();
		removeStopper = undefined;
	});

	/** Stops the next `type` event at the document, on its way down, as a drag library does. */
	function stopNext(type: string) {
		const stop = (event: Event) => {
			event.stopPropagation();
			removeStopper?.();
		};
		document.addEventListener(type, stop, true);
		removeStopper = () => {
			document.removeEventListener(type, stop, true);
			removeStopper = undefined;
		};
	}

	async function setup() {
		const onOpenChange = vi.fn<(...args: OpenChange) => void>();
		await render(DismissPopover, { rootProps: { onOpenChange } });
		expect(floating()).toBeInTheDocument();
		return { onOpenChange };
	}

	it("keeps the popup open on the next click inside it, after a stopped click on the page", async () => {
		const { onOpenChange } = await setup();

		// The click that ends a drag lands on the page and is swallowed.
		stopNext("click");
		fireEvent.click(document.body);
		expect(floating()).toBeInTheDocument();

		fireEvent.click(screen.getByTestId("input"));
		await flushMicrotasks();

		expect(floating()).toBeInTheDocument();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("keeps the popup open on a click in its content, after a stopped click on the popup", async () => {
		const { onOpenChange } = await setup();

		stopNext("click");
		fireEvent.click(screen.getByTestId("floating"));
		expect(floating()).toBeInTheDocument();

		// This click bubbles through the popup element, where the stopped one was awaited.
		fireEvent.click(screen.getByTestId("input"));
		await flushMicrotasks();

		expect(floating()).toBeInTheDocument();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("keeps the popup open through several clicks inside it after a stopped one", async () => {
		const { onOpenChange } = await setup();

		stopNext("click");
		fireEvent.click(document.body);
		fireEvent.click(screen.getByTestId("input"));
		fireEvent.click(screen.getByTestId("floating"));
		fireEvent.click(screen.getByTestId("input"));
		await flushMicrotasks();

		expect(floating()).toBeInTheDocument();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("still closes on a real outside click after a stopped one", async () => {
		const { onOpenChange } = await setup();

		stopNext("click");
		fireEvent.click(document.body);
		expect(floating()).toBeInTheDocument();

		fireEvent.click(document.body);
		await flushMicrotasks();

		expect(floating()).not.toBeInTheDocument();
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
		expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.outsidePress);
	});

	it("closes once, not twice, on the outside click after a stopped one", async () => {
		const { onOpenChange } = await setup();

		stopNext("click");
		fireEvent.click(document.body);
		fireEvent.click(document.body);
		await flushMicrotasks();

		expect(onOpenChange.mock.calls.filter(([open]) => !open)).toHaveLength(1);
	});
});
