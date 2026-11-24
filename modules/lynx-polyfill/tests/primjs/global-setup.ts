// Before the suites run: each PrimJS build, and the WPT and test262 checkouts at their pins, made or
// brought up to date in the package's cache (scripts/primjs/).

import path from "node:path";

import { buildEngine, ENGINES } from "../../scripts/primjs/build.ts";
import { CACHE, checkOut } from "../../scripts/primjs/checkout.ts";
import { TEST262_COMMIT, TEST262_URL, test262Paths } from "./test262/driver.ts";
import { WPT_COMMIT, WPT_URL, wptPaths } from "./wpt/driver.ts";

/** The WPT checkout the suite runs. */
export const WPT_ROOT: string = path.join(CACHE, "wpt");

/** The test262 checkout the suite runs. */
export const TEST262_ROOT: string = path.join(CACHE, "test262");

export function setup(): void {
	for (const engine of ENGINES) buildEngine(engine);
	checkOut(WPT_ROOT, { url: WPT_URL, commit: WPT_COMMIT, paths: wptPaths() });
	checkOut(TEST262_ROOT, { url: TEST262_URL, commit: TEST262_COMMIT, paths: test262Paths() });
}
