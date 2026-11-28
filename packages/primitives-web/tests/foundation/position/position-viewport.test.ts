import { getActivationDirection } from "@sohedra/primitives-core/foundation/position/index.js";
// The Viewport cases the Popover and Tooltip Viewport tests don't cover (those check that there
// is no `data-activation-direction` before a switch).
// - `getActivationDirection` is core's rule and runs as it is.
// - The distance between two triggers isn't exported; its only use is the Viewport's
//   `data-activation-direction` when the popup moves from one trigger to another. So each row
//   renders two Popover triggers at the given rects
//   (../../components/popover/fixtures/popover-viewport.svelte), opens the popover on the
//   first, switches to the second, and expects the attribute's tokens for the expected offset.
//   The rows tell the outcomes apart: the corners of "compares centers, not corners …" would
//   give `right` instead of `left up`.
import { describe, expect, it } from "vitest";

import PartViewportPopover from "../../components/popover/fixtures/popover-viewport.svelte";
import { createRenderer, fireEvent, screen, waitFor } from "../../shim/index.js";

type Offset = { horizontal: number; vertical: number };

const tokens = (value: string | null | undefined) => (value ?? "").split(" ").filter(Boolean);

describe("getActivationDirection", () => {
	// The value is a space-separated token list (matched with `~=` selectors), so compare tokens
	// rather than the exact string.
	it.each([
		{ offset: { horizontal: 100, vertical: 100 }, expected: ["right", "down"] },
		{ offset: { horizontal: -100, vertical: -100 }, expected: ["left", "up"] },
		{ offset: { horizontal: 100, vertical: -100 }, expected: ["right", "up"] },
		{ offset: { horizontal: -100, vertical: 100 }, expected: ["left", "down"] },
		// An axis within tolerance contributes no token.
		{ offset: { horizontal: 100, vertical: 0 }, expected: ["right"] },
		{ offset: { horizontal: -100, vertical: 0 }, expected: ["left"] },
		{ offset: { horizontal: 0, vertical: 100 }, expected: ["down"] },
		{ offset: { horizontal: 0, vertical: -100 }, expected: ["up"] },
		{ offset: { horizontal: 0, vertical: 0 }, expected: [] },
		// The tolerance is 5px and exclusive.
		{ offset: { horizontal: 5, vertical: 5 }, expected: [] },
		{ offset: { horizontal: -5, vertical: -5 }, expected: [] },
		{ offset: { horizontal: 5.5, vertical: -5.5 }, expected: ["right", "up"] },
		{ offset: { horizontal: 6, vertical: 6 }, expected: ["right", "down"] },
		{ offset: { horizontal: -6, vertical: -6 }, expected: ["left", "up"] },
	] satisfies Array<{ offset: Offset; expected: string[] }>)(
		"returns [$expected] for $offset.horizontal, $offset.vertical",
		({ offset, expected }) => {
			expect(getActivationDirection(offset)?.split(" ").filter(Boolean)).toEqual(expected);
		},
	);
});

describe("calculateRelativePosition", () => {
	const { render } = createRenderer();

	function rectStyle([left, top, width, height]: [number, number, number, number]) {
		return `position: fixed; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; padding: 0; border: 0; box-sizing: border-box`;
	}

	it.each([
		{
			name: "measures from the previous trigger to the new one",
			from: [0, 0, 100, 50],
			to: [200, 100, 100, 50],
			expected: { horizontal: 200, vertical: 100 },
		},
		{
			name: "is negative when the new trigger is up and to the left",
			from: [200, 100, 100, 50],
			to: [0, 0, 100, 50],
			expected: { horizontal: -200, vertical: -100 },
		},
		{
			// Centers (50, 25) -> (20, 5); the top-left corners would give (10, 0).
			name: "compares centers, not corners, of differently sized triggers",
			from: [0, 0, 100, 50],
			to: [10, 0, 20, 10],
			expected: { horizontal: -30, vertical: -20 },
		},
		{
			name: "is zero for triggers that share a center",
			from: [0, 0, 100, 100],
			to: [25, 25, 50, 50],
			expected: { horizontal: 0, vertical: 0 },
		},
	] satisfies Array<{
		name: string;
		from: [number, number, number, number];
		to: [number, number, number, number];
		expected: Offset;
	}>)("$name", async ({ from, to, expected }) => {
		await render(PartViewportPopover, {
			triggers: [
				{ payload: 0, testId: "trigger1", style: rectStyle(from), text: "1" },
				{ payload: 1, testId: "trigger2", style: rectStyle(to), text: "2" },
			],
			viewport: { "data-testid": "viewport" } as never,
			content: "numbered",
		});

		fireEvent.click(screen.getByTestId("trigger1"));
		await waitFor(() => {
			expect(screen.getByText("Content 0")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByTestId("trigger2"));

		await waitFor(() => {
			expect(screen.getByText("Content 1")).toBeInTheDocument();
		});
		const viewport = screen.getByTestId("viewport");
		expect(viewport).toHaveAttribute("data-activation-direction");
		expect(tokens(viewport.getAttribute("data-activation-direction"))).toEqual(
			tokens(getActivationDirection(expected)),
		);
	});
});
