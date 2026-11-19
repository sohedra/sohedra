// A plain module with state of its own: each thread has its own copy of it.
import { mainThread } from "@sohedra/lynx/env";

export const thread: string = mainThread ? "main thread" : "background";

let calls = 0;
export function next(): number {
	return ++calls;
}

const g = globalThis as { countedLoads?: string[] };
(g.countedLoads ??= []).push(thread);
