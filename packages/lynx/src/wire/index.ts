// What both threads and the build agree on: names, message shapes and the patch format. Nothing
// outside this folder spells a message between the threads.

export { WIRE_CATALOGUE, wireError, wireMessage } from "./catalogue.ts";
export type { WireCode, WireDetails, WireError, WireReport } from "./catalogue.ts";
export { eventOf, listenerEvent, lynxEventName, removedEventSpelling } from "./events.ts";
export type { LynxEvent, LynxEventType, LynxListener, RemovedEventSpelling } from "./events.ts";
export { GestureType, isGesture } from "./gesture.ts";
export type {
	GestureRef,
	SerializedComposedGesture,
	SerializedGesture,
	SerializedPlainGesture,
} from "./gesture.ts";
export { LIST_ITEM_INFO, listUpdateInfo, Order, unmoved } from "./list-diff.ts";
export type {
	ListChange,
	ListInsertion,
	ListItemInfo,
	ListUpdate,
	ListUpdateInfo,
} from "./list-diff.ts";
export {
	FIRST_FRAME_HANDLE,
	FUNCTION_FIELDS,
	FUNCTION_RUNTIME,
	MAIN_THREAD_FUNCTIONS_ENTRY,
	REGISTER_FUNCTION,
} from "./main-thread-functions.ts";
export type { MainThreadFunction } from "./main-thread-functions.ts";
export { DOCS_BASE, docsLink, formatMessage } from "./messages.ts";
export type { Catalogue, Entry, MessageParts } from "./messages.ts";
export {
	FIRST_FRAME_GLOBAL,
	LAZY_BUNDLE_METHOD,
	MAIN_THREAD_PREFIX,
	PACKAGE_NAME,
	PATCH_METHOD,
	RENDERER_ENTRY,
	TO_BACKGROUND,
} from "./names.ts";
export type { LazyBundleParams, Thread } from "./names.ts";
export { OpCode, ROOT_ID } from "./ops.ts";
export type { AttrValue, Op } from "./ops.ts";
export { checkMessage, keepsMessage, PROTOCOL_VERSION } from "./page.ts";
export type { Receiver, Stamp, Stamped } from "./page.ts";
export {
	decodeCall,
	decodeCell,
	decodeError,
	decodePatch,
	decodeResult,
	encodeCall,
	encodeCell,
	encodeError,
	encodePatch,
	encodeResult,
} from "./patch.ts";
export type {
	CallItem,
	CallRequest,
	CellItem,
	OpsItem,
	Patch,
	PatchItem,
	PatchOf,
	PatchParams,
	ReplyItem,
	Result,
	ThrownError,
} from "./patch.ts";
export { decodeToBackground, encodeToBackground } from "./to-background.ts";
export type {
	CallMessage,
	ErrorMessage,
	ErrorPlace,
	EventMessage,
	ReceivedByBackground,
	ReleaseMessage,
	ReplyMessage,
	SentEvent,
	SentTarget,
	ThreadEvent,
	ToBackground,
} from "./to-background.ts";
