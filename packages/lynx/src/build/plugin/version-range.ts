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
	if (operator === "~" || major === 0) return foundMinor === minor && foundPatch >= patch;
	return foundMinor > minor || (foundMinor === minor && foundPatch >= patch);
}

/**
 * Whether `version` is in `range`, as npm reads it: a caret range (`^0.16.8`) holds the versions
 * from its floor to the next that changes the leftmost number that is not zero, a tilde range
 * (`~5.59.0`) the patches of its minor from its floor, and `||` joins ranges. Only released
 * versions are in a range: a prerelease is in none.
 */
export function satisfiesRange(version: string, range: string): boolean {
	const found = release(version);
	if (found === undefined) return false;
	return range.split("||").some((one) => inOne(found, one.trim()));
}
