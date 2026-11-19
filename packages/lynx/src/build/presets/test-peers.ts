// What a test preset runs the tests with, which an app installs itself: they are the package's
// optional peers, so that an app that only builds does not install them. Checked once, as the
// preset is set up, so a missing one shows as one message and not as a failed import in each test.

import { existsSync } from "node:fs";
import path from "node:path";

import { buildError } from "../diagnostics/messages.ts";

/** What each test preset runs the tests with. */
export const TEST_PEERS: Readonly<Record<"rstest" | "vitest", readonly string[]>> = {
	rstest: ["@rstest/core", "jsdom", "@testing-library/dom"],
	vitest: ["vitest", "vite", "jsdom", "@testing-library/dom"],
};

/** Whether `name` is installed where `root` resolves packages: in a `node_modules` at or above it. */
function installed(name: string, root: string): boolean {
	for (let folder = path.resolve(root); ; folder = path.dirname(folder)) {
		if (existsSync(path.join(folder, "node_modules", name, "package.json"))) return true;
		if (path.dirname(folder) === folder) return false;
	}
}

/**
 * Throws the build's message when the app in `root` lacks what `preset` runs the tests with: its
 * runner's, and `also` what the preset itself loads.
 */
export function checkTestPeers(options: {
	runner: "rstest" | "vitest";
	preset: string;
	root: string;
	also?: readonly string[];
}): void {
	const { runner, preset, root, also = [] } = options;
	const packages = [...TEST_PEERS[runner], ...also].filter((name) => !installed(name, root));
	if (packages.length > 0)
		throw buildError({ code: "test_peers_missing", details: { packages, preset, root } });
}
