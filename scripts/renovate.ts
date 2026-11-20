// Renovate keeps each peer of @sohedra/lynx on the Dependency Dashboard, by a list of names written
// by hand in .github/renovate.json. A peer missing from it would have its dev copy merged past the
// peer range, so the list must equal the binding's peers.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = ".github/renovate.json";
const BINDING = "packages/lynx/package.json";

/** What is wrong with Renovate's peer list in the repository in `root`. */
export function checkRenovate(root: string): string[] {
	// Boundary: JSON has no type; Renovate's config and the manifest have these shapes.
	const config = JSON.parse(readFileSync(join(root, CONFIG), "utf8")) as {
		packageRules?: { matchFileNames?: string[]; matchPackageNames?: string[] }[];
	};
	const manifest = JSON.parse(readFileSync(join(root, BINDING), "utf8")) as {
		peerDependencies?: Record<string, string>;
	};
	const listed = new Set(
		config.packageRules?.find((rule) => rule.matchFileNames?.includes(BINDING))?.matchPackageNames,
	);
	const peers = new Set(Object.keys(manifest.peerDependencies ?? {}));
	const missing = [...peers].filter((name) => !listed.has(name));
	const extra = [...listed].filter((name) => !peers.has(name));
	if (missing.length === 0 && extra.length === 0) return [];
	return [
		`Renovate's peer list in ${CONFIG} doesn't match the peers of ${BINDING} (missing: ${missing.join(", ") || "none"}; not peers: ${extra.join(", ") || "none"}). Make the peer rule's matchPackageNames list each peer.`,
	];
}
