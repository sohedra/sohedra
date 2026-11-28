import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverPortalState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartRootWrapper from "./popover-root-wrapper.svelte";

/**
 * Popover.Portal as the conformance suite sees it: inside an open Popover.Root.
 * It is kept mounted: a click on the portal element is a press outside the (absent) popup, which
 * closes the popover. It resolves its container after mount, so the server leaves it out.
 */
export const popoverPortalConformance: ConformanceSetup<PopoverPortalState> = {
	part: Popover.Portal as Component<Record<string, unknown>>,
	wrapper: PartRootWrapper as Component<ConformanceWrapperProps>,
	props: { keepMounted: true },
	defaultTag: "div",
	clientOnly: true,
};
