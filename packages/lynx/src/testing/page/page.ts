// A test page: the engine fake as the main thread's globals, one `lynx` for both threads, and the
// bridge between them. The page's own scripts start where a device starts them: the main thread's
// before the engine renders, the background's after. They are the runtime's and the app's; a test
// passes them, and nothing runs in their place.

import { createEngine } from "../engine/create-engine.ts";
import type { Engine } from "../engine/create-engine.ts";
import { activeSession, installGlobals, setActiveSession } from "../globals.ts";
import { createBridge } from "./bridge.ts";
import { createLynx } from "./lynx.ts";

/** What a test page starts with. */
export interface TestPageOptions {
	/** The page's initial data, which the engine renders the page with. */
	initData?: Record<string, unknown>;
	/** The host's global props. */
	globalProps?: Record<string, unknown>;
	/** The main thread's script: it runs first, before the engine renders the page. */
	mainThread?: () => void;
	/** The background's script, the app: it runs once the engine has rendered the page. */
	background?: () => void;
	/** The document the elements are made in; the test environment's by default. */
	document?: Document;
	/** The element the page goes in; the document's body by default. */
	container?: Element;
}

/** A running test page. */
export interface TestPage {
	/** The engine fake the page runs on. */
	readonly engine: Engine;
	/** What the page reported with `lynx.reportError`, and what Lynx would report about it. */
	readonly errors: unknown[];
	/** Waits until nothing crosses between the threads and the engine has answered. */
	settle(): Promise<void>;
	/** Ends the page: its end is said, its elements leave the document, the globals are put back. */
	dispose(): void;
}

/** The globals a page's own code sets while it runs, put back when the page ends. */
const PAGE_GLOBALS = [
	"runWorklet",
	"renderPage",
	"updatePage",
	"updateGlobalProps",
	"removeComponents",
];

/** Starts a test page, and ends the one that was running, if any. */
export function startTestPage(options: TestPageOptions = {}): TestPage {
	activeSession()?.dispose();
	const bridge = createBridge();
	const engine = createEngine({
		...(options.document && { document: options.document }),
		...(options.container && { container: options.container }),
		schedule: bridge.send,
	});
	const errors: unknown[] = [];
	const initData = options.initData ?? {};
	const lynx = createLynx({
		bridge,
		lifecycle: engine.lifecycle,
		initData,
		globalProps: options.globalProps ?? {},
		errors,
	});
	// On a device, Lynx's element functions are the main thread's globals.
	const restoreGlobals = installGlobals({ ...engine.functions, lynx }, PAGE_GLOBALS);

	let ended = false;
	const page: TestPage = {
		engine,
		errors,
		settle: bridge.settle,
		dispose() {
			if (ended) return;
			ended = true;
			if (activeSession() === page) setActiveSession(undefined);
			engine.lifecycle.destroy();
			bridge.close();
			restoreGlobals();
			engine.dispose();
		},
	};
	setActiveSession(page);

	options.mainThread?.();
	engine.lifecycle.render(initData);
	// The engine ends a render with a flush of the tree (core/renderer/template_assembler.cc,
	// OnPatchFinish after RenderPage).
	engine.functions.__FlushElementTree();
	options.background?.();
	return page;
}
