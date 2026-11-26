// Shared test setup.
import { afterEach } from "vitest";

import { resetLogs } from "../src/foundation/kernel/kernel-log.js";

afterEach(() => {
	// Dev warnings and errors log each message once per run; let every test see its own.
	resetLogs();
});
