// Known failures around an `{#await}` given a promise, whose pending branch the first frame draws
// as the page starts and the background only after: each is the same on the release before
// hydration paired by branch, and none runs another element's handler. When one passes, drop its
// `.fails`; the generated pages leave each shape out until then (./generated/markup.ts).

import { expect, it } from "@rstest/core";

import AwaitInDeferredRow from "../fixtures/threads/limits/AwaitInDeferredRow.svelte";
import drawAwaitInDeferredRow from "../fixtures/threads/limits/AwaitInDeferredRow.svelte?first-frame";
import IdInPending from "../fixtures/threads/limits/IdInPending.svelte";
import drawIdInPending from "../fixtures/threads/limits/IdInPending.svelte?first-frame";
import { startSveltePage } from "./svelte-page.ts";

const never = new Promise(() => {});

// The background draws the pending branch after the component past the block, so the two take
// their `$props.id()` in the other order: hydration writes the ids over and warns.
it.fails("a component in a pending branch keeps the first frame's $props.id()", async () => {
	const page = startSveltePage(IdInPending, {
		props: () => ({ given: never }),
		firstFrame: { draw: drawIdInPending, props: { given: never } },
	});
	const ids = () =>
		page.engine
			.all()
			.map((element) => page.engine.state(element))
			.filter((state) => state.classes.startsWith("s-"))
			.map((state) => `${state.classes} ${String(state.attrs["id"])}`);
	const frame = ids();
	await page.settle();
	expect(ids()).toEqual(frame);
	expect(page.warnings).toEqual([]);
});

// The first frame draws the row's pending branch; the background's row waits to be asked for, and
// once it is, draws nothing until the promise settles.
it.fails("a deferred row with an {#await} given a promise is drawn as the background renders it", async () => {
	const page = startSveltePage(AwaitInDeferredRow, {
		props: () => ({ given: never, log: [] }),
		firstFrame: { draw: drawAwaitInDeferredRow, props: { given: never, log: [] } },
	});
	const frame = page.engine.texts();
	const alone = startSveltePage(AwaitInDeferredRow, { props: () => ({ given: never, log: [] }) });
	await alone.settle();
	try {
		alone.engine.list(alone.byClass("page-list")).show(0);
	} catch {
		// The row comes with the next flush.
	}
	await alone.settle();
	alone.engine.list(alone.byClass("page-list")).show(0);
	await alone.settle();
	await page.settle();
	expect(frame).toEqual(alone.engine.texts());
});
