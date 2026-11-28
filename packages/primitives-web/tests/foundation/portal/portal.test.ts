// The portal cases the Popover portal tests (../../components/popover/popover.portal.test.ts and
// the Portal conformance runs) don't cover.
// - The popup is a Popover: the trigger is the reference and the Popup the floating element,
//   inside a Positioner, so the portal element is the one marked `data-sohedra-portal` around it.
//   fixtures/portal-null-container.svelte renders the container after mount.
// - "uses the rendered portal ID for the aria-owns relationship": an open non-modal Popover
//   (../focus/fixtures/focus-popover.svelte) whose Portal gets the `id`.
import { describe, expect, it } from "vitest";

import { act, createRenderer, fireEvent, screen } from "../../shim/index.js";
import FfmPopover from "../focus/fixtures/focus-popover.svelte";
import PortalNullContainer from "./fixtures/portal-null-container.svelte";

const flushMicrotasks = () => act(async () => {});

describe("FloatingPortal", () => {
	const { render } = createRenderer();

	it("allows containers to be initially null", async () => {
		await render(PortalNullContainer);

		fireEvent.click(screen.getByTestId("reference"));
		await flushMicrotasks();

		const subRoot = screen.getByTestId("floating").closest("[data-sohedra-portal]");
		const root = screen.getByTestId("root");
		expect(root).toBe(subRoot?.parentElement);
	});

	it("uses the rendered portal ID for the aria-owns relationship", async () => {
		await render(FfmPopover, { open: true, portalProps: { id: "custom-portal" } });
		await flushMicrotasks();

		expect(document.querySelector("[aria-owns]")).toHaveAttribute("aria-owns", "custom-portal");
	});
});
