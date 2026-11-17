// What a test does at its end: the page it started ends, and the process is as it was.

import { activeSession, setActiveSession } from "./globals.ts";

/** Ends the page that is running, if any: its elements leave the document and its globals go. */
export function cleanup(): void {
	const session = activeSession();
	setActiveSession(undefined);
	session?.dispose();
}
