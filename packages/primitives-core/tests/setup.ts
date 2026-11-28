// Shared test setup.
import { afterEach } from "vitest";

import { resetLogs } from "../src/foundation/kernel/kernel-log.js";

declare global {
	// Read by the web's presence wiring; the web package declares its type, which this one does not see.
	var SOHEDRA_ANIMATIONS_DISABLED: boolean | undefined;
}

// Parts that wait for animations complete right away unless a test opts back in.
globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;

afterEach(() => {
	// Dev warnings and errors log each message once per run; let every test see its own.
	resetLogs();
	globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
});
