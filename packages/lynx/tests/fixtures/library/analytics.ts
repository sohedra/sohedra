// A background-only module: a stub on the main thread.
import "background-only";

export const sent: string[] = [];
export function track(name: string): void {
	sent.push(name);
}
