// The ranges the package writes: `^1.2.3` or `1.2.3`, and a peer range from the version tested to
// the end of its major (for 0.x, its minor), widened by hand to a later one as `^1.2.3 || ^2.0.0`,
// which keeps its tested floor. A peer whose minors may break, such as Svelte while its custom
// renderers are experimental, runs to the end of its minor instead: `~1.2.3 || ~1.3.0`.

type Version = [major: number, minor: number, patch: number];

const VERSION = /^[\^~]?(\d+)\.(\d+)\.(\d+)$/;

/** The version `part` names, or undefined. */
function versionOf(part: string): Version | undefined {
	const match = VERSION.exec(part.trim());
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

const isVersion = (version: Version | undefined): version is Version => version !== undefined;

/** Whether version `a` comes before `b`, by major, then minor, then patch. */
const before = (a: Version, b: Version): boolean =>
	a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

/**
 * The line a range covers: for a caret range its major, or for 0.x its minor, or for 0.0.x its
 * patch; for a tilde range its minor.
 */
const lineOf = (operator: string, [major, minor, patch]: Version): Version =>
	operator === "~" || major === 0
		? minor > 0 || operator === "~"
			? [major, minor, 0]
			: [0, 0, patch]
		: [major, 0, 0];

/**
 * Whether `range` is a peer range: caret ranges, or tilde ranges, joined by `||`, each starting a
 * later line.
 */
export function isPeerRange(range: string): boolean {
	const parts = range.split("||").map((part) => part.trim());
	const operator = parts[0]![0]!;
	if (operator !== "^" && operator !== "~") return false;
	const versions = parts.map((part) => (part[0] === operator ? versionOf(part) : undefined));
	if (!versions.every(isVersion)) return false;
	return versions.every(
		(version, index) =>
			index === 0 || before(lineOf(operator, versions[index - 1]!), lineOf(operator, version)),
	);
}

/** The lowest version `range` allows, to install and check in the app at its floors. */
export function floorOf(name: string, range: string): string {
	const versions = range.split("||").map(versionOf);
	if (!versions.every(isVersion))
		throw new Error(
			`${name}'s range ${range} has no floor to install. Write it as ^x.y.z or ~x.y.z, from the version tested, or as such ranges joined by ||.`,
		);
	const lowest = versions.reduce((low, version) => (before(version, low) ? version : low));
	return lowest.join(".");
}
