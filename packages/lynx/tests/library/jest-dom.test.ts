// The matchers of `@testing-library/jest-dom` on the page's elements, which are jsdom elements,
// before and after a tap changed them. The preset resolves jest-dom's CommonJS helpers as Node
// would, with no alias.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

import Panel from "../fixtures/library/Panel.svelte";

expect.extend(matchers);

// The matchers' types are Jest's and Vitest's; both runners run them.
type Dom = TestingLibraryMatchers<unknown, void>;
const check = (value: unknown) => expect(value) as unknown as Dom & { not: Dom };

it("matches the page's elements before and after a tap", async () => {
	const { container, getByText } = await render(Panel);
	const panel = container.querySelector(".panel")!;

	check(panel).toBeInTheDocument();
	check(panel).toHaveClass("panel");
	check(panel).not.toHaveClass("open");
	check(panel).toHaveAttribute("data-state", "closed");
	check(panel).toHaveTextContent("Closed");

	await fireEvent.tap(panel);

	check(panel).toHaveClass("panel", "open");
	check(panel).toHaveAttribute("data-state", "open");
	check(panel).toHaveTextContent("Open");
	check(panel).not.toHaveTextContent("Closed");
	check(getByText("Open")).toBeInTheDocument();
});

it("tells an element that is gone from one that is on the page", async () => {
	const { container, unmount } = await render(Panel);
	const panel = container.querySelector(".panel")!;
	check(panel).toBeInTheDocument();
	await unmount();
	check(panel).not.toBeInTheDocument();
});
