// What the fills report into Lynx: a test's `lynx`, whose `reportError` keeps each report.

/** Puts a `lynx` on this process's global object whose `reportError` pushes onto `caught`. */
export function hearReports(caught: unknown[]): void {
	// Boundary: the fills read the thread's `lynx` by name, a global in this process.
	(globalThis as unknown as { lynx?: unknown }).lynx = {
		reportError: (error: unknown) => void caught.push(error),
	};
}

/** Takes the test's `lynx` away again. */
export function stopHearing(): void {
	delete (globalThis as unknown as { lynx?: unknown }).lynx;
}
