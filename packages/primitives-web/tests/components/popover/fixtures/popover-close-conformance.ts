import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverCloseState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartRootTriggerWrapper from "./popover-root-trigger-wrapper.svelte";

/**
 * Popover.Close as the conformance suite sees it. Rather than in the popup, it sits
 * beside a trigger in an open Popover.Root (it needs only the root), so the server renders it.
 * Its own click handler closes the popover, read back from the trigger's `aria-expanded`.
 */
export const popoverCloseConformance: ConformanceSetup<PopoverCloseState> = {
	part: Popover.Close as Component<Record<string, unknown>>,
	wrapper: PartRootTriggerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "button",
	readOwnClick: (element) =>
		element.ownerDocument
			.querySelector('[data-testid="wrapper-trigger"]')
			?.getAttribute("aria-expanded"),
};
