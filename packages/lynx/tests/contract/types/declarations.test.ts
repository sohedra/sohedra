// The declarations an app gets are bundled for each public entry from the source and committed, so
// a change to the API shows in review. This fails while they differ from what the bundler makes,
// while the published manifest types an entry otherwise, and while one leaves out what the source
// declares.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import {
	augmentationsIn,
	bundleDeclarations,
	DECLARATIONS_COMMAND,
	DECLARED_ENTRIES,
} from "../../../scripts/declarations/index.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");

/** The declaration files written by hand or generated from `@lynx-js/types`. */
const OTHER_DECLARATIONS = [
	"types/client.d.ts",
	"types/elements.d.ts",
	"types/generated/elements.d.ts",
	"types/generated/lynx.d.ts",
];

interface Manifest {
	publishConfig: { exports: Record<string, string | Record<string, string>> };
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;

/** Each `.ts` file under `folder`, from the package's folder, with `/` between folders. */
const filesIn = (folder: string, ending: string): string[] =>
	fs
		.readdirSync(path.join(ROOT, folder), { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(ending))
		.map((file) => `${folder}/${file.split(path.sep).join("/")}`);

describe("the declarations of the public entries", { timeout: 60_000 }, () => {
	it(`are what the bundler makes of the source: run \`${DECLARATIONS_COMMAND}\``, async () => {
		for (const file of await bundleDeclarations())
			expect(
				fs.existsSync(path.join(ROOT, file.path)) &&
					fs.readFileSync(path.join(ROOT, file.path), "utf8"),
				`${file.path} is out of date: run \`${DECLARATIONS_COMMAND}\``,
			).toBe(file.text);
	});

	it("are what the published manifest types each public entry with", () => {
		const published = Object.entries(manifest.publishConfig.exports).filter(
			([entry, target]) =>
				typeof target === "object" && "default" in target && !entry.startsWith("./internal/"),
		);
		expect(published.map(([entry]) => entry).toSorted()).toEqual(
			Object.keys(DECLARED_ENTRIES).toSorted(),
		);
		for (const [entry, target] of published)
			expect((target as Record<string, string>)["types"], entry).toBe(
				`./${DECLARED_ENTRIES[entry]!.declarations}`,
			);
	});

	it("are the only declaration files in types/ besides those written by hand or generated", () => {
		const bundled = Object.values(DECLARED_ENTRIES).map(({ declarations }) => declarations);
		expect(filesIn("types", ".d.ts").toSorted()).toEqual(
			[...OTHER_DECLARATIONS, ...bundled].toSorted(),
		);
	});

	it("carry every augmentation of another package the source declares", () => {
		const carried = new Set(
			Object.values(DECLARED_ENTRIES).flatMap(({ augmentations }) => augmentations ?? []),
		);
		const declaring = filesIn("src", ".ts").filter((file) => augmentationsIn(file).length > 0);
		expect(declaring.filter((file) => !carried.has(file))).toEqual([]);
	});
});
