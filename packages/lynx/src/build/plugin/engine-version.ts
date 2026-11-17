// The Lynx engine versions @sohedra/lynx builds for.

/** The oldest engine the bundle runs on, and the default: no code path serves an older one. */
export const MIN_ENGINE_VERSION = "4.2";

/**
 * The newest engine the encoder encodes for, as a whole version: `@lynx-js/tasm` 0.0.53, the
 * version pinned in `package.json`, encodes for 4.3 and 4.3.0 and refuses 4.3.1. Raise this with
 * the pin; a contract test asks the encoder.
 */
export const MAX_ENGINE_VERSION = "4.3";

/** The numbers of `major.minor[.patch]`. */
function parts(version: string): number[] {
	return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

/** Compare two versions by their numbers: negative when `a` is older. */
function compare(a: string, b: string): number {
	const [left, right] = [parts(a), parts(b)];
	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

/** How `version` sits against the versions @sohedra/lynx builds for. */
export function engineVersionRange(version: string): "old" | "new" | "supported" {
	if (compare(version, MIN_ENGINE_VERSION) < 0) return "old";
	return compare(version, MAX_ENGINE_VERSION) > 0 ? "new" : "supported";
}
