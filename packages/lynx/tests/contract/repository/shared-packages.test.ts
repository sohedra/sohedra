import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { checkSharedPackages } from "../../../../../scripts/shared-packages.ts";

const REPO = path.resolve(import.meta.dirname, "../../../../..");
const folders: string[] = [];

/** A repository with the given packages (folder to package.json and source files). */
function repository(
	packages: Record<string, { manifest: object; files?: Record<string, string> }>,
) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-shared-"));
	folders.push(root);
	for (const [folder, { manifest, files = {} }] of Object.entries(packages)) {
		fs.mkdirSync(path.join(root, folder, "src"), { recursive: true });
		fs.writeFileSync(path.join(root, folder, "package.json"), JSON.stringify(manifest));
		for (const [file, source] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(root, folder, file)), { recursive: true });
			fs.writeFileSync(path.join(root, folder, file), source);
		}
	}
	return root;
}

const shared = { name: "@sohedra/primitives-core", sohedra: { runsOn: ["web", "lynx"] } };

afterEach(() => {
	for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("a package that runs on the web and on Lynx", () => {
	it("passes when it never mentions the binding", () => {
		const root = repository({
			"packages/primitives-core": {
				manifest: { ...shared, dependencies: { svelte: "*" } },
				files: { "src/index.ts": 'import { untrack } from "svelte";\nexport { untrack };\n' },
			},
		});
		expect(checkSharedPackages(root)).toEqual([]);
	});

	it("fails when it depends on the binding, in any kind of dependency", () => {
		for (const kind of [
			"dependencies",
			"devDependencies",
			"peerDependencies",
			"optionalDependencies",
		]) {
			const root = repository({
				"packages/primitives-core": { manifest: { ...shared, [kind]: { "@sohedra/lynx": "*" } } },
			});
			const [problem, ...rest] = checkSharedPackages(root);
			expect(rest).toEqual([]);
			expect(problem).toContain("packages/primitives-core");
			expect(problem).toContain(kind);
		}
	});

	it("fails when a source file imports the binding or one of its entries", () => {
		for (const source of [
			'import { mount } from "@sohedra/lynx";\n',
			'import { render } from "@sohedra/lynx/testing";\n',
			'export * from "@sohedra/lynx/host";\n',
			'const lazy = import("@sohedra/lynx/environment");\n',
		]) {
			const root = repository({
				"packages/primitives-core": { manifest: shared, files: { "src/index.ts": source } },
			});
			const [problem, ...rest] = checkSharedPackages(root);
			expect(rest).toEqual([]);
			expect(problem).toContain("packages/primitives-core/src/index.ts");
		}
	});
	it("is read in src/lib/, but not in its build output", () => {
		const source = 'import { mount } from "@sohedra/lynx";\n';
		const root = repository({
			"packages/primitives-core": {
				manifest: shared,
				files: { "src/lib/index.ts": source, "lib/index.js": source, "dist/index.js": source },
			},
		});
		expect(checkSharedPackages(root)).toEqual([
			"packages/primitives-core/src/lib/index.ts imports @sohedra/lynx, but packages/primitives-core runs on the web and on Lynx. Use Svelte's own APIs and esm-env.",
		]);
	});
});

describe("a package that does not run on both", () => {
	it("may depend on the binding", () => {
		const root = repository({
			"packages/ui": {
				manifest: { name: "@sohedra/ui", dependencies: { "@sohedra/lynx": "*" } },
				files: { "src/index.ts": 'import "@sohedra/lynx";\n' },
			},
			"packages/web-only": {
				manifest: { name: "@sohedra/web-only", sohedra: { runsOn: ["web"] } },
				files: { "src/index.ts": 'import "@sohedra/lynx";\n' },
			},
		});
		expect(checkSharedPackages(root)).toEqual([]);
	});
});

describe("the repository", () => {
	it("passes", () => {
		expect(checkSharedPackages(REPO)).toEqual([]);
	});
});
