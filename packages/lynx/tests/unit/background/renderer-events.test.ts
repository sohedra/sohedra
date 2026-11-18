// Listeners in the renderer: Svelte's `on…` listeners (`addEventListener`) and the element's own
// become Lynx's event types, one handler id per element, type and name.

import { describe, expect, it } from "@rstest/core";

import { OpCode } from "../../../src/wire/index.ts";
import { rendererFixture } from "./renderer-fixture.ts";

const handler = () => {};

function setup() {
	const fixture = rendererFixture();
	const element = fixture.element("view");
	fixture.ops();
	const events = () =>
		fixture.ops().flatMap((op) => (op[0] === OpCode.SetEvent ? [[op[2], op[3], op[4] === 0]] : []));
	return { ...fixture, element, events };
}

describe("an on… listener", () => {
	it.each([
		["tap", false, "bindEvent", "tap"],
		["tap", true, "capture-bind", "tap"],
		["catchtap", false, "catchEvent", "tap"],
		["catchtap", true, "capture-catch", "tap"],
		["catch", false, "bindEvent", "catch"],
		["gotpointercapture", false, "bindEvent", "gotpointercapture"],
	])("%s (capture: %s) binds %s %s, and unbinds it", (type, capture, lynxType, name) => {
		const { renderer, element, events } = setup();
		renderer.addEventListener(element, type, handler, { capture });
		expect(events()).toEqual([[lynxType, name, false]]);
		renderer.removeEventListener(element, type, handler, { capture });
		expect(events()).toEqual([[lynxType, name, true]]);
	});

	it("binds the same way through the element's own addEventListener", () => {
		const { element, events } = setup();
		element.addEventListener("catchtap", handler, { capture: true });
		element.addEventListener("tap", handler);
		expect(events()).toEqual([
			["capture-catch", "tap", false],
			["bindEvent", "tap", false],
		]);
	});

	it("shares one handler id with the other listeners of its slot, which all run", () => {
		const { renderer, element, events, handlers } = setup();
		const ran: string[] = [];
		renderer.addEventListener(element, "tap", () => ran.push("first"));
		renderer.addEventListener(element, "tap", () => ran.push("second"));
		expect(events()).toHaveLength(1);
		element.dispatchEvent({ type: "tap" });
		expect(ran).toEqual(["first", "second"]);
		expect(handlers.size).toBe(1);
	});

	it("is kept until the element is made, then bound with it", () => {
		const { renderer, root, ops } = rendererFixture();
		const view = renderer.createElement("view");
		renderer.addEventListener(view, "tap", handler);
		expect(ops()).toEqual([]);
		renderer.insert(root, view, null);
		expect(ops()).toContainEqual([OpCode.SetEvent, expect.any(Number), "bindEvent", "tap", 1]);
	});

	it("passes a target that is not a node on to its own listener API", () => {
		const { renderer } = setup();
		const calls: string[] = [];
		const target = {
			addEventListener: (type: string) => calls.push(`add ${type}`),
			removeEventListener: (type: string) => calls.push(`remove ${type}`),
		};
		// Boundary: Svelte passes such targets through the renderer's interface.
		renderer.addEventListener(target as never, "change", handler);
		renderer.removeEventListener(target as never, "change", handler);
		expect(calls).toEqual(["add change", "remove change"]);
	});
});
