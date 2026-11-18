// What the main thread's engine lacks, filled in as its runtime starts, before the page's modules
// load. Each fill is made only where the engine has none.

/**
 * Fills in what the main thread's engine lacks, leaving what it has: the global `SystemInfo`, which
 * the background has and the main thread has only on `lynx`. ReactLynx puts it there too.
 *
 * @workaround main-thread-system-info kind=lynx-gap delete-when="Lynx's main thread has a global SystemInfo"
 */
export function fillEngineGaps(
	scope: Record<string, unknown>,
	lynx: { SystemInfo?: unknown },
): void {
	if (scope["SystemInfo"] === undefined && lynx.SystemInfo !== undefined)
		scope["SystemInfo"] = lynx.SystemInfo;
}
