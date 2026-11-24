// Whether a version is in a range of a package.json, for the forms this package's own ranges take:
// `^1.2.3`, `~1.2.3` and `1.2.3`, joined by `||`.

/** `major.minor.patch` as numbers, or `undefined` for a version with a prerelease or any other shape. */
function release(version: string): [number, number, number] | undefined {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Whether `found` is in one range of the forms above; any other form holds nothing. */
function inOne(found: [number, number, number], range: string): boolean {
	const operator = range[0] === "^" || range[0] === "~" ? range[0] : "";
	const floor = release(range.slice(operator.length));
	if (floor === undefined) return false;
	const [major, minor, patch] = floor;
	const [foundMajor, foundMinor, foundPatch] = found;
	if (operator === "") return foundMajor === major && foundMinor === minor && foundPatch === patch;
	if (foundMajor !== major) return false;
	if (operator === "^" && major === 0 && minor === 0)
		return foundMinor === 0 && foundPatch === patch;
	if (operator === "~" || major === 0) return foundMinor === minor && foundPatch >= patch;
	return foundMinor > minor || (foundMinor === minor && foundPatch >= patch);
}

/**
 * Whether `version` is in `range`, as npm reads it: a caret range (`^0.16.8`) holds the versions
 * from its floor to the next that changes the leftmost number that is not zero (`^0.0.3` holds
 * only `0.0.3`), a tilde range
 * (`~5.59.0`) the patches of its minor from its floor, and `||` joins ranges. Only released
 * versions are in a range: a prerelease is in none.
 */
export function satisfiesRange(version: string, range: string): boolean {
	const found = release(version);
	if (found === undefined) return false;
	return range.split("||").some((one) => inOne(found, one.trim()));
}

/**
 * Whether `version` is a release above every range of `range`: past the floor of each, and in none.
 * A newer release of this package may then support it; a version below or between them, or a
 * prerelease, never will.
 */
export function aboveRange(version: string, range: string): boolean {
	const found = release(version);
	if (found === undefined || satisfiesRange(version, range)) return false;
	return range.split("||").every((one) => {
		const floor = release(one.trim().replace(/^[~^]/, ""));
		if (floor === undefined) return false;
		const index = found.findIndex((part, at) => part !== floor[at]);
		return index === -1 || found[index]! > floor[index]!;
	});
}
