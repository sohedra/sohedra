// The global `SystemInfo`, which the background has and the main thread has only on `lynx`. A
// Lynx global, not the web's, so the binding fills it, not the polyfill folder.

/**
 * Puts `lynx.SystemInfo` on the global object where the engine has none. ReactLynx puts it there
 * too.
 *
 * @workaround main-thread-system-info kind=lynx-gap delete-when="Lynx's main thread has a global SystemInfo"
 */
export function fillSystemInfo({
	scope,
	lynx,
}: {
	scope: Record<string, unknown>;
	lynx: { SystemInfo?: unknown };
}): void {
	if (scope["SystemInfo"] === undefined && lynx.SystemInfo !== undefined)
		scope["SystemInfo"] = lynx.SystemInfo;
}
