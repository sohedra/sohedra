// What both threads and the build agree on: names, message shapes and the patch format.

export { lynxEventName, removedEventSpelling } from "./events.ts";
export type { RemovedEventSpelling } from "./events.ts";
export {
	FIRST_FRAME_HANDLE,
	FUNCTION_FIELDS,
	FUNCTION_RUNTIME,
	MAIN_THREAD_FUNCTIONS_ENTRY,
	REGISTER_FUNCTION,
} from "./main-thread-functions.ts";
export { DOCS_BASE, docsLink, formatMessage } from "./messages.ts";
export type { Catalogue, Entry, MessageParts } from "./messages.ts";
export { MAIN_THREAD_PREFIX, PACKAGE_NAME, RENDERER_ENTRY, WINDOW_SIZE_ENTRY } from "./names.ts";
export type { Thread } from "./names.ts";
