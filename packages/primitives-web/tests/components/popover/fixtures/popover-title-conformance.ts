import type { Component } from "svelte";

import { Popover } from "#lib/components/popover/index.js";
import type { PopoverTitleState } from "#lib/components/popover/popover-types.js";

import type {
	ConformanceSetup,
	ConformanceWrapperProps,
} from "../../../conformance/conformance-setup.js";
import PartRootTriggerWrapper from "./popover-root-trigger-wrapper.svelte";

/**
 * Popover.Title as the conformance suite sees it. Rather than in the popup, it sits
 * beside a trigger in an open Popover.Root (it needs only the root), so the server renders it.
 */
export const popoverTitleConformance: ConformanceSetup<PopoverTitleState> = {
	part: Popover.Title as Component<Record<string, unknown>>,
	wrapper: PartRootTriggerWrapper as Component<ConformanceWrapperProps>,
	defaultTag: "h2",
};
