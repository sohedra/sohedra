// Every module the package vendors (src/fills/vendor/) parses on each PrimJS build as
// Lynx ships it: they are bundled into an app as they are, past the app's own lowering.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { VENDOR } from "../../scripts/vendor/bundle.ts";
import { ENGINES, runShell } from "./primjs.ts";

const modules = fs
	.readdirSync(VENDOR)
	.filter((file) => file.endsWith(".js"))
	.sort();

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"the PrimJS of Lynx $name",
	({ engine }) => {
		it.each(modules)("parses src/fills/vendor/%s", async (file) => {
			const run = await runShell(engine, ["--parse-module", path.join(VENDOR, file)]);
			expect(run.output).toBe("");
			expect(run.status).toBe(0);
		});
	},
);
