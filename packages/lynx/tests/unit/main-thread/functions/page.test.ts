// A page's main-thread functions on their own: what a page that reloads or ends drops.

import { describe, expect, it } from "@rstest/core";

import { createCodeStyles } from "../../../../src/main-thread/code-styles.ts";
import { createFlattening } from "../../../../src/main-thread/flatten.ts";
import { createFunctionsPage } from "../../../../src/main-thread/functions/page.ts";
import { functionsGlobal } from "../../../../src/main-thread/globals.ts";
import { installGlobals } from "../../../../src/testing/globals.ts";
import { engineForEach, smallPage } from "../../testing/engine/engine-fixture.ts";

const engine = engineForEach();

function functionsPage() {
	const restore = installGlobals({ ...engine().functions });
	const sent: unknown[] = [];
	const reports: unknown[] = [];
	const functions = createFunctionsPage({
		styles: createCodeStyles(),
		flattening: createFlattening(),
		send: (message) => void sent.push(message),
		report: (error) => void reports.push(error),
		flush() {},
		afterLayout: (run) => run(),
		soon: (callback) => callback(),
		nextTurn: () => false,
		idOf: () => undefined,
	});
	return { functions, sent, reports, restore, inner: smallPage(engine()).inner };
}

describe("a page's main-thread functions", () => {
	it("run no function ref still waiting once the page is silenced", () => {
		const { functions, inner, restore } = functionsPage();
		let runs = 0;
		functionsGlobal().bodies["unit:attach"] = () => {
			runs++;
		};
		functions.setAttribute(inner, "main-thread:ref", { _wkltId: "unit:attach" });
		functions.silence();
		functions.settle();
		expect(runs).toBe(0);
		restore();
	});

	it("run nothing the engine hands back that is no function, and say so once", () => {
		const { functions, reports, restore } = functionsPage();
		expect(functions.runWorklet({ label: "a copy" }, [], { source: 1 })).toBeUndefined();
		functions.runWorklet({ label: "another" }, [], { source: 1 });
		expect(reports).toEqual([expect.objectContaining({ code: "main_thread_value_not_runnable" })]);
		restore();
	});
});
