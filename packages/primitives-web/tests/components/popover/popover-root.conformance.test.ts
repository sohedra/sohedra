// The tree is the contained `TestPopover` fixture (Root, Trigger, Portal, Positioner, Popup),
// with the parts' props mapped onto its `rootProps`, `triggerProps`, `portalProps`, `popupProps`.
// `open` goes to the fixture's own `open` (bound to the Root), which a spread can't override.

import { beforeEach, describe } from "vitest";

import { popupConformanceTests } from "../../conformance/popup-conformance.js";
import { createRenderer } from "../../shim/index.js";
import TestPopover from "./fixtures/popover-test.svelte";

describe("<Popover.Root />", () => {
	beforeEach(() => {
		globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
	});

	const { render } = createRenderer();

	popupConformanceTests({
		Component: TestPopover,
		createProps: ({ root: { open, ...rootProps } = {}, ...props }) => ({
			variant: "contained",
			triggerChildren: "Open menu",
			open,
			rootProps,
			triggerProps: props.trigger,
			portalProps: props.portal,
			popupProps: props.popup,
		}),
		render,
		triggerMouseAction: "click",
		expectedPopupRole: "dialog",
		// The fixture's popup has no Title to name it.
		axe: { popupProps: { "aria-label": "Popover" } },
	});
});
