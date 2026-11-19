// A reader of the page's data outside the page's components: an effect root a module keeps.
import { initData } from "@sohedra/lynx/host";

/** Keeps the page's title in `log` each time it changes; returns how to stop. */
export function watchTitle(log: unknown[]): () => void {
	return $effect.root(() => {
		$effect(() => {
			log.push(initData.current["title"]);
		});
	});
}
