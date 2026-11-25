// A known failure, in Svelte's async mode only: an `{#await}` given a promise in the pending branch
// of one given a promise. The first frame draws both pending branches; the background never draws
// the outer one, so the loading state the first frame showed goes at hydration. The same on the
// release before hydration paired by branch; given a value inside, or in the default mode, it is
// right. When this passes, drop `.fails`.

import { expect, it } from "@rstest/core";

import AwaitInPending from "../../fixtures/threads/async/AwaitInPending.svelte";
import drawAwaitInPending from "../../fixtures/threads/async/AwaitInPending.svelte?first-frame";
import { startSveltePage } from "../svelte-page.ts";

it.fails("keeps the pending branches the first frame drew, of an {#await} in another's", async () => {
	const never = new Promise(() => {});
	const props = { outer: never, inner: never, log: [] };
	const page = startSveltePage(AwaitInPending, {
		props: () => props,
		firstFrame: { draw: drawAwaitInPending, props },
	});
	const frame = page.engine.texts();
	await page.settle();
	expect(page.engine.texts()).toEqual(frame);
});
