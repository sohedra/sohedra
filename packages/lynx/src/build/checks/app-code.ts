// Which files are the app's own code, which the build checks for what fails on Lynx: a package's
// code is its author's to fix, and reaches the app as it is. A workspace package outside the app's
// folder counts as a package.

import path from "node:path";

/** Whether `file` is the app's own: in the app's folder `root`, and not a package's under `node_modules`. */
export function isAppCode(file: string, root: string): boolean {
	const relative = path.relative(root, file);
	return (
		relative !== "" &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative) &&
		!/(?:^|[\\/])node_modules[\\/]/.test(relative)
	);
}
