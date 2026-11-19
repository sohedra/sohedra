// How the applier binds an element's event, by the event's type.

import type { LynxEventType } from "../wire/index.ts";
import type { ListenerOptions } from "./globals.ts";

/** The engine's `closure_type` with which it reads `bind_type`. */
const CLOSURE_CORE = 2;

/**
 * How each event type is bound: `bind_type` 1 is bubble, 2 capture, 3 capture and catch, 4
 * bubble and catch (Lynx's `Event::BindType`).
 */
export const LISTENER_OPTIONS: Readonly<Record<LynxEventType, ListenerOptions>> = {
	bindEvent: { closure_type: CLOSURE_CORE, bind_type: 1 },
	"capture-bind": { closure_type: CLOSURE_CORE, bind_type: 2 },
	"capture-catch": { closure_type: CLOSURE_CORE, bind_type: 3 },
	catchEvent: { closure_type: CLOSURE_CORE, bind_type: 4 },
};
