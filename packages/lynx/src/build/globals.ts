// The Node globals the build reads, in one place.

/** The environment variables of the process that builds. */
export const environment: Readonly<Record<string, string | undefined>> = process.env;
