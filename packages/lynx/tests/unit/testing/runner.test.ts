// The test library's messages name the preset of the runner the setup file named, or both.

import { afterEach, expect, it } from "@rstest/core";

import { setTestRunner, testRunner } from "../../../src/testing/globals.ts";
import { presetName } from "../../../src/testing/library/session.ts";

const before = testRunner();
afterEach(() => setTestRunner(before ?? "rstest"));

it("names Rstest's preset, Vitest's, or both when no setup file said", () => {
	setTestRunner("rstest");
	expect(presetName()).toBe("withSvelteLynx() from @sohedra/lynx/config/rstest");
	setTestRunner("vitest");
	expect(presetName()).toBe("svelteLynx() from @sohedra/lynx/config/vitest");
	setTestRunner(undefined as never);
	expect(presetName()).toBe(
		"withSvelteLynx() from @sohedra/lynx/config/rstest or svelteLynx() from @sohedra/lynx/config/vitest",
	);
});
