// The types of what each import fills (scripts/types/generate.ts) are what writing them again
// gives: from the installed TypeScript's web types and the entries' snapshot of the globals each
// import installs.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { GENERATE_COMMAND, generateTypes } from "../../scripts/types/generate.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("the generated types", () => {
	it(`are what \`${GENERATE_COMMAND}\` writes`, async () => {
		const files = await generateTypes();
		const written = fs
			.readdirSync(path.join(ROOT, "types/generated"))
			.map((name) => `types/generated/${name}`)
			.sort();
		expect(files.map((file) => file.path).sort()).toEqual(written);
		for (const file of files)
			expect(fs.readFileSync(path.join(ROOT, file.path), "utf8"), file.path).toBe(file.text);
	});
});
