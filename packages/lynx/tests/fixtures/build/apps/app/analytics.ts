// Background-only: the main thread gets a stub with these exports.
import "background-only";
import { heavy } from "./heavy.ts";

export function track(name: string): { name: string } {
	heavy(name);
	return { name };
}
export const CONFIG = { endpoint: "https://example.com" };
export default { log: (...args: unknown[]) => console.log(...args) };
