import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { checkRenovate } from "../../../../../scripts/renovate.ts";

const REPO = path.resolve(import.meta.dirname, "../../../../..");
const folders: string[] = [];

afterEach(() => {
	for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/** A repository whose Renovate peer rule lists `names` and whose binding has `peers`. */
function repository(names: string[], peers: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-renovate-"));
	folders.push(root);
	const rule = { matchFileNames: ["packages/lynx/package.json"], matchPackageNames: names };
	fs.mkdirSync(path.join(root, ".github"));
	fs.writeFileSync(
		path.join(root, ".github/renovate.json"),
		JSON.stringify({ packageRules: [{ matchDepTypes: ["devDependencies"] }, rule] }),
	);
	fs.mkdirSync(path.join(root, "packages/lynx"), { recursive: true });
	fs.writeFileSync(
		path.join(root, "packages/lynx/package.json"),
		JSON.stringify({ peerDependencies: peers }),
	);
	return root;
}

describe("Renovate's peer list", () => {
	it("passes when it names each peer of @sohedra/lynx but Svelte", () => {
		const root = repository(["vite", "jsdom"], { jsdom: "^31.0.1", svelte: "*", vite: "^8.3.8" });
		expect(checkRenovate(root)).toEqual([]);
	});

	it("names a peer it is missing, and one that is no longer a peer", () => {
		const [problem, ...rest] = checkRenovate(repository(["jsdom", "vitest"], { vite: "^8.3.8" }));
		expect(rest).toEqual([]);
		expect(problem).toContain("vite");
		expect(problem).toContain("jsdom");
		expect(problem).toContain("vitest");
	});

	it("holds in this repository", () => {
		expect(checkRenovate(REPO)).toEqual([]);
	});
});
