import { resetLogs } from "@sohedra/primitives-core/foundation/kernel/kernel-log.js";
// Shared test setup.
import { afterEach } from "vitest";

afterEach(() => {
	// Dev warnings and errors log each message once per run; let every test see its own.
	resetLogs();
});
