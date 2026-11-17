// The setup file's cleanup: each test ends the page it started.

import { describe, expect, it } from "@rstest/core";

import { activeSession, setActiveSession } from "../../../src/testing/globals.ts";
import { cleanup } from "../../../src/testing/index.ts";

describe("cleanup", () => {
	it("disposes the page that is running, and only once", () => {
		let disposed = 0;
		setActiveSession({ dispose: () => void disposed++ });
		cleanup();
		expect(disposed).toBe(1);
		cleanup();
		expect(disposed).toBe(1);
	});

	it("does nothing when no page runs", () => {
		setActiveSession(undefined);
		expect(() => cleanup()).not.toThrow();
		expect(activeSession()).toBeUndefined();
	});
});
