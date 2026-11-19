// Lynx's dev client on a test page's background: the bundler's hot updates, and Lynx's `reload`.

import { reloadAfterCrash } from "../../../src/background/dev-client.ts";
import type { SveltePage } from "../svelte-page.ts";

/**
 * The bundler's hot updates on `page`'s background, and Lynx's `reload` there. `save` lands one
 * update, as a save does, and answers how many times the page was loaded again so far.
 */
export function devLoop(page: SveltePage): { save(): number } {
	const handlers: ((status: string) => void)[] = [];
	let reloads = 0;
	Object.assign(page.lynx.background, { reload: () => void reloads++ });
	page.asBackground(() =>
		reloadAfterCrash({ addStatusHandler: (handler) => void handlers.push(handler) }),
	);
	return {
		save() {
			page.asBackground(() => {
				for (const status of ["check", "prepare", "ready", "dispose", "apply", "idle"])
					for (const handler of handlers) handler(status);
			});
			return reloads;
		},
	};
}
