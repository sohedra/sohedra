// A listener on the page's root hears a tap wherever on the page it happens, as `global-bindtap`
// did, and stops when its effect ends.

import { expect, it } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import RootListener from "../fixtures/library/RootListener.svelte";

it("hears a tap outside its component's elements, and one on them", async () => {
	const { container } = await render(RootListener);
	const heard = () => container.querySelector("#heard")!.textContent;
	await fireEvent.tap(container.querySelector("#elsewhere")!);
	expect(heard()).toBe("elsewhere");
	await fireEvent.tap(container.querySelector("#listener")!);
	expect(heard()).toBe("elsewhere | listener");
});

it("hears no more once its effect ends", async () => {
	const { container } = await render(RootListener);
	const heard = () => container.querySelector("#heard")!.textContent;
	await fireEvent.tap(container.querySelector("#stop")!);
	expect(heard()).toBe("stop");
	await fireEvent.tap(container.querySelector("#elsewhere")!);
	expect(heard()).toBe("stop");
});
