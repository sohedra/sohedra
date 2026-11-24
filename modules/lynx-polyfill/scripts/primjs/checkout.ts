// Checkouts of other repositories at a pinned commit, in the package's cache (`.cache/`, which git
// ignores): PrimJS's source, and the WPT and test262 suites the package is tested with. None
// of it is committed or shipped. A checkout holds only the paths asked for (git's sparse checkout,
// over a fetch without file contents), so the large suites cost the folders the tests read.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The package's cache of downloads and builds, which git ignores. */
export const CACHE: string = path.join(PACKAGE_ROOT, ".cache");

/** A repository at a commit, and the paths of it to check out (every path, without `paths`). */
export interface Checkout {
	url: string;
	commit: string;
	/** Folders of the repository, each from its root, such as `/resources/`. */
	paths?: readonly string[];
}

/** The checkout's stamp, or nothing before the first checkout: read once, so no check runs ahead of it. */
function readStamp(stamp: string): string | undefined {
	try {
		return fs.readFileSync(stamp, "utf8");
	} catch (error) {
		// Boundary: Node's file errors carry their code.
		if ((error as { code?: string }).code === "ENOENT") return undefined;
		throw error;
	}
}

function git(folder: string, args: string[]): void {
	execFileSync("git", ["-c", "advice.detachedHead=false", ...args], {
		cwd: folder,
		stdio: ["ignore", "ignore", "inherit"],
	});
}

/**
 * Checks `checkout` out into `folder`, unless it is there with the same commit and paths, and
 * returns `folder`.
 */
export function checkOut(folder: string, checkout: Checkout): string {
	const stamp = path.join(folder, ".git", "sohedra-checkout.json");
	const wanted = JSON.stringify({ commit: checkout.commit, paths: checkout.paths ?? null });
	if (readStamp(stamp) === wanted) return folder;
	if (!fs.existsSync(path.join(folder, ".git"))) {
		fs.mkdirSync(folder, { recursive: true });
		git(folder, ["init", "--quiet"]);
		git(folder, ["remote", "add", "origin", checkout.url]);
	}
	if (checkout.paths) git(folder, ["sparse-checkout", "set", "--no-cone", ...checkout.paths]);
	else if (fs.existsSync(path.join(folder, ".git", "info", "sparse-checkout")))
		git(folder, ["sparse-checkout", "disable"]);
	git(folder, ["fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", checkout.commit]);
	git(folder, ["checkout", "--quiet", "--force", checkout.commit]);
	fs.writeFileSync(stamp, wanted);
	return folder;
}
