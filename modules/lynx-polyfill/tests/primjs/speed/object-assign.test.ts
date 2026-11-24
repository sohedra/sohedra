// What replacing PrimJS's `Object.assign` with core-js's costs (`fillWrongBuiltIns`, for a getter
// that hides a later key during the copy): each engine's own against the fill's, on both threads'
// PrimJS, timed in the shell. A floor against an order-of-magnitude slowdown, not a benchmark: the
// shell runs on the computer, not a phone.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import { ENGINES, runShell } from "../primjs.ts";
import { buildThreadScript } from "../thread-script.ts";

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-assign-speed-"));
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

describe.each(ENGINES.map((engine) => ({ engine, name: engine.name })))(
	"Object.assign on the PrimJS of Lynx $name",
	({ engine }) => {
		it("is the fill's, at most twenty times slower than the engine's own", async () => {
			const script = await buildThreadScript({
				thread: "background",
				bridge: { module: "tests/primjs/speed/assign-bridge.ts", connect: "connectAssignSpeed" },
				folder: path.join(work, engine.name),
			});
			const run = await runShell(engine, [script]);
			expect(run.output).toBe("");
			const [timing] = run.reports;
			expect(timing).toMatchObject({ replaced: true });
			// Boundary: the bridge's report, which holds these numbers.
			const { nativeSmall, nativeWide, filledSmall, filledWide } = timing as Record<
				"nativeSmall" | "nativeWide" | "filledSmall" | "filledWide",
				number
			>;
			// Written for the pull request that changes it: `pnpm -F @sohedra/lynx-polyfill test:primjs`.
			process.stdout.write(
				`Object.assign on Lynx ${engine.name}: 3 keys ×200k ${nativeSmall} ms → ${filledSmall} ms; 30 keys ×20k ${nativeWide} ms → ${filledWide} ms\n`,
			);
			expect(filledSmall).toBeLessThan(Math.max(nativeSmall, 10) * 20);
			expect(filledWide).toBeLessThan(Math.max(nativeWide, 10) * 20);
		}, 120_000);
	},
);
