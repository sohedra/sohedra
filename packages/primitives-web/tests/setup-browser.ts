// Sets up each browser test file and test: state the browser holds across tests and files (the
// tester frame Playwright acts on, the real pointer's position) does not leak into a test.
import { beforeAll, beforeEach } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
	interface BrowserCommands {
		awaitTesterFrame: () => Promise<void>;
		parkPointer: () => Promise<void>;
	}
}

beforeAll(async () => {
	await commands.awaitTesterFrame();
});

beforeEach(async () => {
	await commands.parkPointer();
});
