// The floor of a range the package writes: `^1.2.3`, `1.2.3`, or a peer range Renovate widened to
// a new major or 0.x minor (`^1.2.3 || ^2.0.0`), which keeps its tested floor.

const VERSION = /^\^?(\d+)\.(\d+)\.(\d+)$/;

/** The lowest version `range` allows, to install and check in the app at its floors. */
export function floorOf(name: string, range: string): string {
	const versions = range.split("||").map((part) => VERSION.exec(part.trim()));
	if (versions.some((version) => version === null))
		throw new Error(
			`${name}'s range ${range} has no floor to install. Write it as ^x.y.z, from the version tested, or as such ranges joined by ||.`,
		);
	const [lowest] = versions
		.map((version) => version!.slice(1, 4).map(Number))
		.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
	return lowest!.join(".");
}
