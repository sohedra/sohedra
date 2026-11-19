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

/** A repository with this Renovate peer rule and one package with this manifest. */
function repository(options: { names?: string[]; manifest: object; config?: string }): string {
	const { names = ["jsdom", "@rstest/**"], manifest } = options;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-renovate-"));
	folders.push(root);
	const rule = { matchDepTypes: ["devDependencies", "peerDependencies"], matchPackageNames: names };
	fs.mkdirSync(path.join(root, ".github"));
	fs.writeFileSync(
		path.join(root, ".github/renovate.json"),
		options.config ?? JSON.stringify({ packageRules: [{ groupName: "Lynx" }, rule] }),
	);
	fs.mkdirSync(path.join(root, "packages/lynx"), { recursive: true });
	fs.writeFileSync(path.join(root, "packages/lynx/package.json"), JSON.stringify(manifest));
	return root;
}

describe("Renovate's peer rule", () => {
	it("passes when it names every peer, and each peer's dev copy is an exact version", () => {
		const manifest = {
			devDependencies: { jsdom: "31.0.1", "@rstest/core": "0.12.6", svelte: "https://x" },
			peerDependencies: { jsdom: "^31.0.1", "@rstest/core": "^0.12.6", svelte: "*" },
		};
		expect(checkRenovate(repository({ manifest }))).toEqual([]);
	});

	it("names each peer but Svelte, whose build is pinned by its URL", () => {
		const manifest = { peerDependencies: { jsdom: "^31.0.1", vite: "^8.3.8", svelte: "*" } };
		const [problem, ...rest] = checkRenovate(repository({ manifest }));
		expect(rest).toEqual([]);
		expect(problem).toContain("packages/lynx/package.json");
		expect(problem).toContain("vite");
	});

	it("needs each peer's dev copy at an exact version, so one pull request moves both", () => {
		const manifest = {
			devDependencies: { jsdom: "^31.0.1" },
			peerDependencies: { jsdom: "^31.0.1" },
		};
		const [problem, ...rest] = checkRenovate(repository({ manifest }));
		expect(rest).toEqual([]);
		expect(problem).toContain("jsdom");
		expect(problem).toContain('"31.0.1"');
	});

	it("is found, in a config that parses", () => {
		const manifest = { peerDependencies: { jsdom: "^31.0.1" } };
		for (const config of ["{", JSON.stringify({ packageRules: [] })]) {
			const [problem, ...rest] = checkRenovate(repository({ manifest, config }));
			expect(rest).toEqual([]);
			expect(problem).toContain(".github/renovate.json");
		}
	});

	it("holds in this repository", () => {
		expect(checkRenovate(REPO)).toEqual([]);
	});
});
