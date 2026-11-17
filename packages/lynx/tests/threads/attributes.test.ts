// Attribute values as the engine reads them: objects and arrays stay values, bare boolean
// attributes are true, a spread is applied like single attributes, and an attribute set to null
// is removed.

import { describe, expect, it } from "@rstest/core";

import Attributes from "../fixtures/threads/Attributes.svelte";
import { startSveltePage } from "./svelte-page.ts";

async function attributes() {
	const page = startSveltePage(Attributes);
	await page.settle();
	return { page, attrs: (token: string) => page.engine.state(page.byClass(token)).attrs };
}

describe("attribute values", () => {
	it("keep objects and arrays as values, and data-* in the dataset", async () => {
		const { page, attrs } = await attributes();
		expect(attrs("object")["accessibility-actions"]).toEqual([{ name: "activate", label: "Go" }]);
		expect(page.engine.state(page.byClass("object")).dataset).toEqual({ config: { a: 1 } });
		expect(attrs("object")["data-config"]).toBeUndefined();
		expect(attrs("array")["item-snap"]).toEqual(["x", "y"]);
	});

	it("read bare attributes as true, and keep an empty string", async () => {
		const { attrs } = await attributes();
		expect(attrs("bare")["muted"]).toBe(true);
		expect(attrs("bare")["loop"]).toBe(true);
		expect(attrs("explicit")["muted"]).toBe(true);
		expect(attrs("explicit")["loop"]).toBe(false);
		expect(attrs("blank")["placeholder"]).toBe("");
	});

	it("apply a spread with its typed values, and leave out what is null", async () => {
		const { attrs } = await attributes();
		expect(attrs("spread")).toMatchObject({
			"sticky-top": true,
			muted: true,
			loop: false,
			"span-count": 2,
			animation: { name: "fade" },
			title: "plain",
		});
		expect("hidden" in attrs("spread")).toBe(false);
	});

	it("join style: directives to the style attribute's text", async () => {
		const { page } = await attributes();
		const styles = page.engine.state(page.byClass("styled")).inlineStyles;
		expect(styles.get("padding")).toBe("2px");
		expect(styles.get("color")).toBe("red");
	});

	it("remove an attribute set to null, and set it again", async () => {
		const { page, attrs } = await attributes();
		expect(attrs("toggle")["title"]).toBe("on");
		page.engine.dispatch(page.byClass("toggle"), { type: "tap" });
		await page.settle();
		expect("title" in attrs("toggle")).toBe(false);
		page.engine.dispatch(page.byClass("toggle"), { type: "tap" });
		await page.settle();
		expect(attrs("toggle")["title"]).toBe("on");
		expect(page.errors).toEqual([]);
	});
});
