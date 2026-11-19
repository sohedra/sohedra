// The run's folder of shared builds (shared-build.ts): made before the first test file and removed
// after the last, so no run reads another's builds.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The variable that names the run's folder of shared builds. */
export const SHARED_BUILDS = "SOHEDRA_LYNX_SHARED_BUILDS";

export function setup(): void {
	process.env[SHARED_BUILDS] = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-builds-"));
}

export function teardown(): void {
	const folder = process.env[SHARED_BUILDS];
	if (folder !== undefined) fs.rmSync(folder, { recursive: true, force: true });
}
