import { expect, it } from "@rstest/core";
import { fireEvent, render, screen } from "@sohedra/lynx/testing";

import App from "../../src/App.svelte";

it("counts taps, from the first frame on", async () => {
	await render(App, { lynx: { firstFrame: true } });
	expect(screen.getByText("Count: 0")).toBeTruthy();

	await fireEvent.tap(screen.getByText("Add 1"));
	expect(screen.getByText("Count: 1")).toBeTruthy();
});
