// Sets each test's starting state: dev warnings and errors log again, and animations are off.
import { resetLogs } from "@sohedra/primitives-core/foundation/kernel";
import { afterEach } from "vitest";

// Parts that wait for animations complete right away unless a test opts back in.
globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;

afterEach(() => {
	// Dev warnings and errors log each message once per run; let every test see its own.
	resetLogs();
	globalThis.SOHEDRA_ANIMATIONS_DISABLED = true;
});
