// The types generated from `@lynx-js/types` are committed: they are the binding's API, and a move to
// a new `@lynx-js/types` shows as their diff. This fails while they differ from what the generator
// makes, and while they hold a type the editor would compute for each element.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";
import ts from "typescript";

import {
	generateTypes,
	OMITTED_TAGS,
	readLynxTypes,
	withAdditions,
} from "../../../scripts/types/index.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");

describe("the generated types", { timeout: 60_000 }, () => {
	it("are what the generator makes of @lynx-js/types: run `pnpm -F @sohedra/lynx generate`", async () => {
		for (const file of await generateTypes())
			expect(fs.readFileSync(path.join(ROOT, file.path), "utf8"), file.path).toBe(file.text);
	});

	it("hold no mapped or conditional type, and no key made from a template", () => {
		const file = path.join(ROOT, "types/generated/elements.d.ts");
		const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ESNext);
		const found: string[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isMappedTypeNode(node) || ts.isConditionalTypeNode(node))
				found.push(node.getText(source).slice(0, 60));
			if (
				ts.isIndexSignatureDeclaration(node) &&
				node.parameters.some(
					(parameter) => parameter.type && ts.isTemplateLiteralTypeNode(parameter.type),
				)
			)
				found.push(node.getText(source));
			ts.forEachChild(node, visit);
		};
		visit(source);
		expect(found).toEqual([]);
	});

	it("leave out <frame>, and name no type of @lynx-js/types", () => {
		const text = fs.readFileSync(path.join(ROOT, "types/generated/elements.d.ts"), "utf8");
		expect(text).not.toMatch(/^\s*frame: /m);
		expect(text).not.toContain('from "@lynx-js/types');
	});

	it("stop generating once Lynx's types declare what the binding adds for them", () => {
		const model = readLynxTypes(OMITTED_TAGS);
		const overlay = model.elements.find((element) => element.tag === "overlay")!;
		overlay.attributes.push({
			name: "events-pass-through",
			optional: true,
			type: "boolean",
			doc: [],
		});
		expect(() => withAdditions(model)).toThrow(
			"@lynx-js/types now declares events-pass-through on <overlay>: remove it from scripts/types/additions.ts.",
		);
	});
});
