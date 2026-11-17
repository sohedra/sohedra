// A `<list>` as the engine keeps it: the callbacks Lynx would call to show and recycle cells, and
// the updates the page sends.

import { describe, expect, it } from "@rstest/core";

import type { LynxElement } from "../../../../src/testing/index.ts";
import { engineForEach, smallPage } from "./engine-fixture.ts";

const engine = engineForEach();

/** A list in a page, whose cells are `<list-item>`s made on request. */
function list() {
	const { page, outer } = smallPage(engine());
	const f = engine().functions;
	const asked: unknown[][] = [];
	const returned: unknown[][] = [];
	const cells: LynxElement[] = [];
	const element = f.__CreateList(
		0,
		(_list, listId, index, operationId) => {
			asked.push([listId, index, operationId]);
			const cell = f.__CreateElement("list-item", 0);
			cells.push(cell);
			f.__AppendElement(element, cell);
			return f.__GetElementUniqueID(cell);
		},
		(_list, listId, sign) => returned.push([listId, sign]),
	);
	f.__AppendElement(outer, element);
	return { page, element, asked, returned, cells };
}

describe("a list", () => {
	it("is an element with the tag list, and can be handed what Lynx asks of it", () => {
		const { element } = list();
		expect((element as Element).localName).toBe("list");
		expect(typeof engine().list(element).componentAtIndex).toBe("function");
	});

	it("takes the tag its info names, as the engine does", () => {
		const f = engine().functions;
		const custom = f.__CreateList(
			0,
			() => 0,
			() => {},
			{ tag: "x-list" },
		);
		expect((custom as Element).localName).toBe("x-list");
		expect(typeof engine().list(custom).show).toBe("function");
	});

	it("shows the cell at an index, numbering each request, and takes it back", () => {
		const { element, asked, returned, cells } = list();
		const handle = engine().list(element);
		const first = handle.show(0);
		const second = handle.show(5);
		expect(first).toBe(cells[0]);
		expect(second).toBe(cells[1]);
		const listId = engine().functions.__GetElementUniqueID(element);
		expect(asked).toEqual([
			[listId, 0, 1],
			[listId, 5, 2],
		]);
		handle.hide(first);
		expect(returned).toEqual([[listId, engine().functions.__GetElementUniqueID(first)]]);
	});

	it("throws when the cell asked for is not an element the engine made", () => {
		const { element } = list();
		const f = engine().functions;
		f.__UpdateListCallbacks(
			element,
			() => 9999,
			() => {},
		);
		expect(() => engine().list(element).show(0)).toThrow(
			"The list has no cell for the unique id 9999 at index 0.",
		);
	});

	it("keeps every update-list-info the page sends, and tells the test's listener inside the call", () => {
		const { element } = list();
		const handle = engine().list(element);
		const seen: unknown[] = [];
		handle.onUpdate = (update) => seen.push(update);
		const update = { insertAction: [{ position: 0 }], removeAction: [], updateAction: [] };
		engine().functions.__SetAttribute(element, "update-list-info", update);
		expect(handle.updates).toEqual([update]);
		expect(seen).toEqual([update]);
		expect(engine().functions.__GetAttributeByName(element, "update-list-info")).toBeUndefined();
	});

	it("takes new callbacks, and calls those from then on", () => {
		const { element, asked } = list();
		const f = engine().functions;
		const calls: string[] = [];
		const cell = f.__CreateElement("list-item", 0);
		f.__UpdateListCallbacks(
			element,
			() => (calls.push("new"), f.__GetElementUniqueID(cell)),
			() => calls.push("enqueue"),
			() => calls.push("many"),
		);
		expect(engine().list(element).show(0)).toBe(cell);
		expect(calls).toEqual(["new"]);
		expect(asked).toEqual([]);
		expect(typeof engine().list(element).componentAtIndexes).toBe("function");
	});

	it("is refused for an element that is not a list", () => {
		const { inner } = smallPage(engine());
		expect(() => engine().list(inner)).toThrow("<view> 3 is not a list.");
		expect(() =>
			engine().functions.__UpdateListCallbacks(
				inner,
				() => 0,
				() => {},
			),
		).toThrow("__UpdateListCallbacks param 0 should be a list");
		expect(() => engine().functions.__SetAttribute(inner, "update-list-info", {})).not.toThrow();
	});
});
