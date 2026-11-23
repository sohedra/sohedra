// The npm packages the polyfill folder bundles (scripts/polyfill/bundle.ts): each vendored module is
// what bundling its entry gives today, from packages pinned exactly, credited in NOTICE, and
// updated only by a person (Renovate's `polyfill` group never merges itself).

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { bundleVendor, VENDOR, vendorNames } from "../../../scripts/polyfill/bundle.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const REPOSITORY = path.resolve(ROOT, "../..");

// Boundary: JSON has no type; the manifest and Renovate's config have these shapes.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
};
const renovate = JSON.parse(
	fs.readFileSync(path.join(REPOSITORY, ".github/renovate.json"), "utf8"),
) as {
	packageRules: {
		groupName?: string | null;
		matchPackageNames?: string[];
		automerge?: boolean;
		dependencyDashboardApproval?: boolean;
	}[];
};
const notice = fs.readFileSync(path.join(ROOT, "NOTICE"), "utf8");

const names = vendorNames();
const bundles = new Map<string, Awaited<ReturnType<typeof bundleVendor>>>();

describe("the vendored modules", () => {
	it("are each what bundling its entry gives: run `pnpm -F @sohedra/lynx vendor` after a package update", async () => {
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			const bundle = await bundleVendor(name);
			bundles.set(name, bundle);
			expect(fs.readFileSync(path.join(VENDOR, `${name}.js`), "utf8"), name).toBe(bundle.code);
		}
		const files = fs.readdirSync(VENDOR).sort();
		expect(files).toEqual(names.flatMap((name) => [`${name}.d.ts`, `${name}.js`]).sort());
	}, 120_000);

	it("start with the license of each package in them", () => {
		for (const [name, { code, packages }] of bundles) {
			expect(packages.length, name).toBeGreaterThan(0);
			for (const pkg of packages)
				expect(code, `${name}: ${pkg}`).toContain(
					`/*!\n * ${pkg} ${manifest.devDependencies[pkg]} (`,
				);
		}
	});

	it("come from dev dependencies pinned exactly, which no app installs", () => {
		for (const { packages } of bundles.values()) {
			for (const pkg of packages) {
				expect(manifest.devDependencies[pkg], pkg).toMatch(/^\d+\.\d+\.\d+$/);
				expect(manifest.dependencies[pkg], pkg).toBeUndefined();
			}
		}
	});

	it("are credited in NOTICE, each package with its version", () => {
		for (const { packages } of bundles.values()) {
			for (const pkg of packages)
				expect(notice, pkg).toContain(`- ${pkg} ${manifest.devDependencies[pkg]}`);
		}
	});

	it("update in Renovate's polyfill group, which waits for a person, pinned exactly", () => {
		const group = renovate.packageRules.find((rule) => rule.groupName === "polyfill");
		expect(group?.automerge).toBe(false);
		expect(group?.dependencyDashboardApproval).toBe(false);
		const listed = group?.matchPackageNames ?? [];
		for (const { packages } of bundles.values())
			for (const pkg of packages) expect(listed, pkg).toContain(pkg);
		for (const pkg of listed) expect(manifest.devDependencies[pkg], pkg).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
