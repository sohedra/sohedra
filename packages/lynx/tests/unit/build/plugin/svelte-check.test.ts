// The Svelte the app installed: it has custom renderers, and it is in the range this package was
// tested with, the range its package.json gives `svelte` as a peer.

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import { PACKAGE_ROOT } from "../../../../src/build/plugin/layers.ts";
import { checkSvelte } from "../../../../src/build/plugin/svelte-check.ts";

const made: string[] = [];
afterAll(() => {
	for (const folder of made) fs.rmSync(folder, { recursive: true, force: true });
});

/** The range of `svelte` in this package's `peerDependencies`. */
const RANGE = (
	createRequire(import.meta.url)(path.join(PACKAGE_ROOT, "package.json")) as {
		peerDependencies: Record<string, string>;
	}
).peerDependencies["svelte"]!;

/** The floor of each tilde range in `RANGE`, as `[major, minor, patch]`. */
const floors = [...RANGE.matchAll(/~(\d+)\.(\d+)\.(\d+)/g)].map((match) =>
	match.slice(1).map(Number),
);
const [lowMajor, lowMinor, lowPatch] = floors[0]!;
const [highMajor, highMinor] = floors.at(-1)!;
const lowest = `${lowMajor}.${lowMinor}.${lowPatch}`;
const belowLowest =
	lowPatch! > 0 ? `${lowMajor}.${lowMinor}.${lowPatch! - 1}` : `${lowMajor}.${lowMinor! - 1}.99`;
const aboveHighest = `${highMajor}.${highMinor! + 1}.0`;

/** An app whose installed Svelte says it is `version`: a compiler that takes any option. */
function appWithSvelte(version: string): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-svelte-"));
	made.push(root);
	fs.writeFileSync(path.join(root, "package.json"), "{}");
	const svelte = path.join(root, "node_modules", "svelte");
	fs.mkdirSync(svelte, { recursive: true });
	fs.writeFileSync(
		path.join(svelte, "package.json"),
		JSON.stringify({
			name: "svelte",
			version,
			exports: { "./compiler": "./compiler.cjs", "./package.json": "./package.json" },
		}),
	);
	fs.writeFileSync(
		path.join(svelte, "compiler.cjs"),
		`exports.VERSION = ${JSON.stringify(version)};\nexports.compile = () => ({});\n`,
	);
	return root;
}

/** What `checkSvelte` throws for the app in `root`, or `undefined`. */
function refusal(root: string): { code?: string; message: string } | undefined {
	try {
		checkSvelte(root);
		return undefined;
	} catch (error) {
		return error as { code?: string; message: string };
	}
}

describe("the range this package was tested with", () => {
	it("is tilde ranges, one for each Svelte minor, joined by `||`", () => {
		expect(RANGE).toMatch(/^~\d+\.\d+\.\d+(?: \|\| ~\d+\.\d+\.\d+)*$/);
	});

	it("holds the Svelte this package's own tests run with", () => {
		expect(() => checkSvelte(PACKAGE_ROOT)).not.toThrow();
	});
});

describe("checkSvelte", () => {
	it("takes a Svelte in the range", () => {
		expect(refusal(appWithSvelte(lowest))).toBeUndefined();
		expect(refusal(appWithSvelte(`${highMajor}.${highMinor}.99`))).toBeUndefined();
	});

	it.each([
		["just below the range", belowLowest],
		["just above the range", aboveHighest],
	])("refuses a Svelte %s, naming the version, the range and the fix", (_, version) => {
		const root = appWithSvelte(version);
		const error = refusal(root);
		expect(error?.code).toBe("svelte_version_unverified");
		expect(error?.message.split("\n")[0]).toBe(
			`The installed Svelte (${version}, ${root}) is outside the range @sohedra/lynx is tested with, ${RANGE}.`,
		);
		expect(error?.message).toContain(
			`Install Svelte ${RANGE}, or update @sohedra/lynx to a version tested with Svelte ${version}.`,
		);
		expect(error?.message).toContain("https://sohedra.com/e/svelte_version_unverified");
	});

	it("refuses a prerelease, even of a version in the range", () => {
		const error = refusal(appWithSvelte(`${lowMajor}.${lowMinor}.${lowPatch! + 1}-next.0`));
		expect(error?.code).toBe("svelte_version_unverified");
	});
});
