// Renovate's peer rule (.github/renovate.json) keeps up with the packages' peers. When a peer's next
// major or next 0.x minor comes out, the rule widens the peer range, keeping its tested floor, and
// moves the package's dev copy of the peer in the same pull request. Renovate drops one of two
// updates of a package in one file that start from the same value, so the dev copy is an exact
// version where the peer is a range. Svelte is left out: its build is pinned by its URL.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";

const CONFIG = ".github/renovate.json";
const EXACT = /^\d+\.\d+\.\d+$/;

interface Rule {
	matchDepTypes?: string[];
	matchPackageNames?: string[];
}

interface Manifest {
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

/** The package names of Renovate's peer rule, or why there are none. */
function peerRuleNames(root: string): string[] | string {
	let config: { packageRules?: Rule[] };
	try {
		// Boundary: JSON has no type; Renovate's config has this shape.
		config = JSON.parse(readFileSync(join(root, CONFIG), "utf8")) as { packageRules?: Rule[] };
	} catch (error) {
		return `${CONFIG} can't be read as JSON (${String(error)}). Run Renovate's config validator on it.`;
	}
	const rule = config.packageRules?.find((rule) =>
		rule.matchDepTypes?.includes("peerDependencies"),
	);
	return (
		rule?.matchPackageNames ??
		`${CONFIG} has no rule for peerDependencies. Restore the peer rule, which widens a peer range for a new major.`
	);
}

/** Whether Renovate's `pattern` (a name or a glob; this config uses no regex) matches `name`. */
const matches = (name: string, pattern: string): boolean =>
	name === pattern || matchesGlob(name, pattern);

/** What is wrong with Renovate's peer rule in the repository in `root`. */
export function checkRenovate(root: string): string[] {
	const problems: string[] = [];
	const names = peerRuleNames(root);
	if (typeof names === "string") return [names];
	for (const parent of ["packages", "modules"]) {
		if (!existsSync(join(root, parent))) continue;
		for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
			const file = `${parent}/${entry.name}/package.json`;
			if (!entry.isDirectory() || !existsSync(join(root, file))) continue;
			// Boundary: JSON has no type; both fields are optional.
			const manifest = JSON.parse(readFileSync(join(root, file), "utf8")) as Manifest;
			for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
				if (name === "svelte") continue;
				if (!names.some((pattern) => matches(name, pattern))) {
					problems.push(
						`${file} has the peer ${name}, which Renovate's peer rule doesn't name. Add it to that rule's matchPackageNames in ${CONFIG}.`,
					);
				}
				const copy = manifest.devDependencies?.[name];
				if (copy !== undefined && !EXACT.test(copy)) {
					const floor = /^\^?(\d+\.\d+\.\d+)/.exec(range)?.[1] ?? "x.y.z";
					problems.push(
						`${file} has the dev copy of the peer ${name} at ${copy}, a range, so Renovate can't move it beside the peer. Write it as an exact version, such as "${floor}".`,
					);
				}
			}
		}
	}
	return problems;
}
