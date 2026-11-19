// The Node globals the build reads, in one place.

/** The environment variables of the process that builds. */
export const environment: Readonly<Record<string, string | undefined>> = process.env;

/** The folder the build was started in. */
export function workingDirectory(): string {
	return process.cwd();
}

/** The version of Node.js that builds (`v22.13.0`). */
export function nodeVersion(): string {
	return process.version;
}

/**
 * Runs `run` with the warnings `quiet` matches left unsaid; every other warning goes out as before.
 * Node says some of its warnings once per process, as the first call warns.
 */
export function withoutWarnings<T>(
	quiet: (warning: string, type: unknown) => boolean,
	run: () => T,
): T {
	const emit = process.emitWarning;
	process.emitWarning = function emitWarning(this: unknown, ...args: Parameters<typeof emit>) {
		const [warning, options] = args;
		const type =
			typeof options === "string" ? options : (options as { type?: unknown } | undefined)?.type;
		if (quiet(String(warning instanceof Error ? warning.message : warning), type)) return;
		Reflect.apply(emit, process, args);
	} as typeof emit;
	try {
		return run();
	} finally {
		process.emitWarning = emit;
	}
}
