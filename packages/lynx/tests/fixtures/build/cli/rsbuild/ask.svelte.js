// An effect in a rune module: Svelte's server copy drops its body, so on the main thread nothing
// reads `quadruple` but its registration.
import { runOnMainThread } from "@sohedra/lynx";
import { quadruple } from "press-lib";

export function asker(read, write) {
	$effect(() => {
		const value = read();
		if (value > 0) void runOnMainThread(quadruple)(value).then(write);
	});
}
