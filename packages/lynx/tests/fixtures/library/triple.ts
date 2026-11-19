// A main-thread function in a plain module: compiled where it is written, run on the main thread,
// called from the background.
import { runOnMainThread } from "@sohedra/lynx";

export function triple(value: number): number {
	"main thread";
	return value * 3;
}

export const tripled = (value: number): Promise<number> => runOnMainThread(triple)(value);
