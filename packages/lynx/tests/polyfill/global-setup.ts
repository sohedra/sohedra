// Before the suites run: each PrimJS build, and the WPT checkout at its pin, made or brought up to
// date in the package's cache (scripts/primjs/).

import path from "node:path";

import { buildEngine, ENGINES } from "../../scripts/primjs/build.ts";
import { CACHE, checkOut } from "../../scripts/primjs/checkout.ts";
import { WPT_COMMIT, WPT_URL, wptPaths } from "./wpt/driver.ts";

/** The WPT checkout the suite runs. */
export const WPT_ROOT: string = path.join(CACHE, "wpt");

export function setup(): void {
	for (const engine of ENGINES) buildEngine(engine);
	checkOut(WPT_ROOT, { url: WPT_URL, commit: WPT_COMMIT, paths: wptPaths() });
}
