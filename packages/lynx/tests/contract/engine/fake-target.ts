// The engine fake as a target of the behavior spec: a test page with a page element, laid out as
// a device lays it out where the spec reads it (plain views flattened, a rectangle that is not at
// the origin), and driven as a device is.

import { installGlobals } from "../../../src/testing/globals.ts";
import { startTestPage } from "../../../src/testing/index.ts";
import type { EngineTarget } from "./behaviors.ts";

/** Where every element is, for `boundingClientRect`: the fake has no layout. */
const RECT = { left: 20, top: 20, width: 100, height: 100 };

/** A fresh page on the engine fake, as a target; `end()` takes it down. */
export function fakeTarget(): EngineTarget & { end(): void } {
	const page = startTestPage();
	// Plain views are flattened, as on a device: the engine fake's default.
	const { engine } = page;
	engine.respondWith((method) =>
		method === "boundingClientRect" ? { code: 0, data: { ...RECT } } : { code: 0 },
	);
	engine.functions.__CreatePage("0", 0);
	engine.functions.__FlushElementTree();
	let restore: (() => void) | undefined;
	return {
		functions: engine.functions,
		engineEvents: page.lynx.mainThread.getEngine(),
		useRunWorklet(run) {
			restore?.();
			restore = installGlobals({ runWorklet: run });
		},
		async tap(element) {
			engine.dispatch(element, { type: "tap" });
			await page.settle();
		},
		async gesture(element, id, callback) {
			// A device runs no callback for a detector that is gone, or a callback it does not have.
			const detector = engine.detectors(element).find((entry) => entry.id === id);
			if (detector?.callbacks.some((entry) => entry.name === callback)) {
				engine.fireGesture(element, { id, callback });
			}
			await page.settle();
		},
		async showCell(list, index) {
			engine.list(list).show(index);
			await page.settle();
		},
		async updatePage(data) {
			engine.lifecycle.update(data);
			await page.settle();
		},
		settle: () => page.settle(),
		end() {
			restore?.();
			page.dispose();
		},
	};
}
