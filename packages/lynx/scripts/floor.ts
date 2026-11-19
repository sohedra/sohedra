// The ranges the package writes: `^1.2.3` or `1.2.3`, and a peer range from the version tested to
// the end of its major (for 0.x, its minor), widened by hand to a later one as `^1.2.3 || ^2.0.0`,
// which keeps its tested floor.

type Version = [major: number, minor: number, patch: number];

const VERSION = /^\^?(\d+)\.(\d+)\.(\d+)$/;

/** The version `part` names, or undefined. */
function versionOf(part: string): Version | undefined {
	const match = VERSION.exec(part.trim());
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

const isVersion = (version: Version | undefined): version is Version => version !== undefined;

/** Whether version `a` comes before `b`, by major, then minor, then patch. */
const before = (a: Version, b: Version): boolean =>
	a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

/** The line a caret range covers: its major, or for 0.x its minor, or for 0.0.x its patch. */
const lineOf = ([major, minor, patch]: Version): Version =>
	major > 0 ? [major, 0, 0] : minor > 0 ? [0, minor, 0] : [0, 0, patch];

/** Whether `range` is a peer range: caret ranges joined by `||`, each starting a later line. */
export function isPeerRange(range: string): boolean {
	const parts = range.split("||");
	if (!parts.every((part) => part.trim().startsWith("^"))) return false;
	const versions = parts.map(versionOf);
	if (!versions.every(isVersion)) return false;
	return versions.every(
		(version, index) => index === 0 || before(lineOf(versions[index - 1]!), lineOf(version)),
	);
}

/** The lowest version `range` allows, to install and check in the app at its floors. */
export function floorOf(name: string, range: string): string {
	const versions = range.split("||").map(versionOf);
	if (!versions.every(isVersion))
		throw new Error(
			`${name}'s range ${range} has no floor to install. Write it as ^x.y.z, from the version tested, or as such ranges joined by ||.`,
		);
	const lowest = versions.reduce((low, version) => (before(version, low) ? version : low));
	return lowest.join(".");
}
