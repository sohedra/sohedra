// `.current` of a main-thread ref belongs to the main thread. Read on the background it is the
// initial value, which looks like the real one: a development build says so, once for each ref.

import { expect, it, rs } from "@rstest/core";
import { fireEvent, render } from "@sohedra/lynx/testing";

import ReadsRef from "../fixtures/library/ReadsRef.svelte";

it("warns once, naming runOnMainThread, and still gives the initial value", async () => {
	const warn = rs.spyOn(console, "warn").mockImplementation(() => {});
	try {
		const results: unknown[] = [];
		const { container } = await render(ReadsRef, { props: { results } });
		await fireEvent.tap(container.querySelector(".read")!);
		await fireEvent.tap(container.querySelector(".read")!);
		expect(results).toEqual([5, 5, 5, 5]);
		const texts = warn.mock.calls.map((call) => String(call[0]));
		expect(texts).toHaveLength(1);
		expect(texts[0]).toContain("runOnMainThread");
	} finally {
		warn.mockRestore();
	}
});
