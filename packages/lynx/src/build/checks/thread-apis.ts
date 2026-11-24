// The APIs only one of Lynx's threads has, for the build's thread-safety checks. Each entry cites
// where Lynx, or ReactLynx, says so. The globals `@sohedra/lynx-polyfill` fills that only the
// background has are the wire's table (`globalGap`), not repeated here.

import { ELEMENT_FUNCTIONS } from "./element-functions.ts";

/**
 * Globals only the background has.
 *
 * - `NativeModules`: ReactLynx removes `NativeModules.call` from the main thread's bundle as code
 *   that does nothing there (`@lynx-js/react-rsbuild-plugin`, src/optimizeBundleSize.ts).
 * - `fetch`: in the background's `Lynx` only (`@lynx-js/types`, types/background-thread/lynx.d.ts);
 *   on the main thread, `@sohedra/lynx-polyfill/fetch` installs a `fetch` that throws.
 */
const BACKGROUND_GLOBALS: ReadonlySet<string> = new Set(["NativeModules", "fetch"]);

/**
 * Members of `lynx` only the background has: those of the background's `Lynx` that neither
 * `CommonLynx` nor the main thread's `Lynx` has (`@lynx-js/types` 4.4, types/background-thread/
 * lynx.d.ts, types/common/lynx.d.ts, types/main-thread/lynx.d.ts). Left out: `__globalProps`, which
 * the main thread's first frame reads, `__presetData`, which no source places, and `performance`,
 * which both have.
 */
const BACKGROUND_LYNX: ReadonlySet<string> = new Set([
	"addFont",
	"beforePublishEvent",
	"cancelResourcePrefetch",
	"createIntersectionObserver",
	"createSelectorQuery",
	"EventSource",
	"fetch",
	"getElementById",
	"getJSModule",
	"getSharedData",
	"loadDynamicComponent",
	"queueMicrotask",
	"ReadableStream",
	"registerModule",
	"registerSharedDataObserver",
	"reload",
	"removeSharedDataObserver",
	"requestResourcePrefetch",
	"requireModule",
	"requireModuleAsync",
	"setObserverFrameRate",
	"setSharedData",
	"startRecording",
	"stopRecording",
]);

/**
 * Members of `lynx` neither thread has in Svelte on Lynx: ReactLynx's main-thread runtime adds them
 * (`@lynx-js/react`, runtime/src/worklet-runtime/api/lynxApi.ts), Lynx's own `lynx` doesn't have
 * them on either thread (`@lynx-js/types`), and the binding gives a main-thread element its own
 * `querySelector` instead.
 */
const MISSING_LYNX: ReadonlySet<string> = new Set(["querySelector", "querySelectorAll"]);

/** Whether `name`, `lynx.<member>`, is a member of `lynx` neither thread has. */
export const isMissingLynxMember = (name: string): boolean =>
	name.startsWith("lynx.") && MISSING_LYNX.has(name.slice("lynx.".length));

/** The thread a read of `name` (a global, or `lynx.<member>`) can only run on, if only one has it. */
export function onlyThread(name: string): "background" | "main-thread" | undefined {
	if (name.startsWith("lynx.")) {
		const member = name.slice("lynx.".length);
		return BACKGROUND_LYNX.has(member) ? "background" : undefined;
	}
	if (BACKGROUND_GLOBALS.has(name)) return "background";
	if (ELEMENT_FUNCTIONS.has(name)) return "main-thread";
	return undefined;
}
