// Where Svelte's development build says an element or an error came from.

import { describe, expect, it } from "@rstest/core";

import {
	componentInMessage,
	componentOfNode,
	sourceLocation,
} from "../../../../src/svelte/runtime/index.ts";

describe("componentOfNode", () => {
	it("is the file's name of the component whose markup made the node", () => {
		const node = { __svelte_meta: { loc: { file: "src/lib/Card.svelte", line: 3, column: 1 } } };
		expect(componentOfNode(node)).toBe("Card.svelte");
		expect(sourceLocation(node)).toBe("src/lib/Card.svelte:3:1");
	});

	it("is undefined for a node a production build made", () => {
		expect(componentOfNode({})).toBeUndefined();
	});
});

describe("componentInMessage", () => {
	it("is the innermost component of Svelte's lines under the message", () => {
		const message = "the effect threw\n\n\tin $effect\n\tin Card.svelte\n\tin App.svelte\n";
		expect(componentInMessage(message)).toBe("Card.svelte");
	});

	it("skips the effect's own line, whatever its name", () => {
		expect(componentInMessage("x\n\n\tin <unknown>\n\tin Row.svelte\n")).toBe("Row.svelte");
		expect(componentInMessage("x\n\n  in Row.svelte\n")).toBe("Row.svelte");
	});

	it("is undefined for a message without them, as a production build's", () => {
		expect(componentInMessage("the effect threw")).toBeUndefined();
		expect(componentInMessage("Look in App.svelte for it.")).toBeUndefined();
	});
});
