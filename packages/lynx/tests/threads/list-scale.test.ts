// A list of 1,000 rows: what crosses to the main thread, in ops and in bytes, is pinned. A change
// that sends more must raise a budget here, on purpose.

import { describe, expect, it } from "@rstest/core";

import { decodeCell } from "../../src/wire/index.ts";
import type { Patch } from "../../src/wire/index.ts";
import ManyRows from "../fixtures/threads/ManyRows.svelte";
import { startSveltePage } from "./svelte-page.ts";

interface Row {
	id: number;
	label: string;
}

/**
 * The budgets, as measured: raise one only on purpose, and say why in the pull request. A list
 * update carries the list's whole order, so a change of one row still sends 1,001 ids.
 */
const BUDGET = {
	start: { ops: 9004, bytes: 261_608 },
	append: { ops: 10, bytes: 5377 },
	reverse: { ops: 1, bytes: 62_229 },
};

/** The ops of patches, those of their cells too, and their size as sent. */
function measure(patches: Patch[]): { ops: number; bytes: number } {
	let ops = 0;
	let bytes = 0;
	for (const patch of patches) {
		bytes += JSON.stringify(patch).length;
		for (const item of patch.items) {
			if (item[0] === "ops") ops += item[1].length;
			else if (item[0] === "cell") ops += decodeCell(item[2]).length;
		}
	}
	return { ops, bytes };
}

/** What was sent is no more than the budget. */
function within(
	sent: { ops: number; bytes: number },
	budget: { ops: number; bytes: number },
): void {
	expect(sent.ops).toBeLessThanOrEqual(budget.ops);
	expect(sent.bytes).toBeLessThanOrEqual(budget.bytes);
}

async function manyRows() {
	const handles: Record<string, unknown> = {};
	const page = startSveltePage(ManyRows, { props: () => ({ handles }) });
	await page.settle();
	const feed = handles["feed"] as { rows: Row[] };
	const change = async (update: (rows: Row[]) => Row[]) => {
		const sent = page.patches.length;
		page.asBackground(() => (feed.rows = update(feed.rows)));
		await page.settle();
		return measure(page.patches.slice(sent));
	};
	return { page, change };
}

describe("a list of 1,000 rows", () => {
	it("starts within its budget, and makes no cell before Lynx asks", async () => {
		const { page } = await manyRows();
		within(measure(page.patches), BUDGET.start);
		expect(page.engine.list(page.byClass("list")).updates[0]!.insertAction).toHaveLength(1000);
		expect(page.engine.madeCount("list-item")).toBe(0);
		expect(page.errors).toEqual([]);
	});

	it("adds a row within its budget", async () => {
		const { change } = await manyRows();
		const sent = await change((rows) => [...rows, { id: 1001, label: "Row 1001" }]);
		within(sent, BUDGET.append);
	});

	it("reverses the rows within its budget, with no cell made again", async () => {
		const { page, change } = await manyRows();
		const made = page.engine.madeCount("view");
		const sent = await change((rows) => rows.toReversed());
		within(sent, BUDGET.reverse);
		expect(page.engine.madeCount("view")).toBe(made);
	});

	it("shows a cell Lynx asks for", async () => {
		const { page } = await manyRows();
		const cell = page.engine.list(page.byClass("list")).show(999);
		expect(page.engine.text(cell)).toBe("Row 1000");
	});
});
