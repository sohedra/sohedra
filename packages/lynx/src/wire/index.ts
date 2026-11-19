// What both threads and the build agree on: names, message shapes and the patch format. Nothing
// outside this folder spells a message between the threads.

export { WIRE_CATALOGUE, wireError, wireMessage } from "./catalogue.ts";
export type { WireCode, WireDetails, WireError, WireReport } from "./catalogue.ts";
export { describeOp } from "./describe-op.ts";
export { escapeJsonText } from "./escape.ts";
export type { TagOf } from "./describe-op.ts";
export {
	eventOf,
	listenerEvent,
	lynxEventName,
	removedEventSpelling,
	sentNames,
} from "./events.ts";
export type { LynxEvent, LynxEventType, LynxListener, RemovedEventSpelling } from "./events.ts";
export { GestureState, GestureType, isGesture, plainGestures } from "./gesture.ts";
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
	FUNCTIONS_GLOBAL,
	HANDLE_FIELDS,
	isBackgroundHandle,
	isMainThreadFunction,
	isRefHandle,
	MAIN_THREAD_FUNCTIONS_ENTRY,
	REF_FIELDS,
	REGISTER_FUNCTION,
	RUN_FUNCTION,
	RUN_SOURCE,
} from "./main-thread-functions.ts";
export type {
	BackgroundFunctionHandle,
	FunctionsGlobal,
	FunctionsRuntime,
	MainThreadFunction,
	MainThreadRefHandle,
} from "./main-thread-functions.ts";
export { DOCS_BASE, docsLink, formatMessage } from "./messages.ts";
export type { Catalogue, Entry, MessageParts } from "./messages.ts";
export {
	ASYNC_LIST,
	DEFER,
	DEFERRED_ROW,
	FIRST_FRAME_GLOBAL,
	LAZY_BUNDLE_METHOD,
	MAIN_THREAD_PREFIX,
	PACKAGE_NAME,
	PATCH_METHOD,
	PROPS_ID,
	PROPS_ID_PREFIX,
	RENDERER_ENTRY,
	TEXT_CONTAINERS,
	TO_BACKGROUND,
} from "./names.ts";
export type { LazyBundleParams, Thread } from "./names.ts";
export { OpCode, ROOT_ID } from "./ops.ts";
export type { AttrValue, Op } from "./ops.ts";
export { checkMessage, keepsMessage, PROTOCOL_VERSION } from "./page.ts";
export { createRepeats, withCount } from "./repeats.ts";
export type { Repeats } from "./repeats.ts";
export type { Receiver, Stamp, Stamped } from "./page.ts";
export {
	asError,
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
	thrownText,
} from "./patch.ts";
export type {
	CallItem,
	CallRequest,
	CellItem,
	CellMark,
	OpsItem,
	Patch,
	PatchItem,
	PatchOf,
	PatchParams,
	ReplyItem,
	Result,
	RewriteItem,
	ThrownError,
} from "./patch.ts";
export { decodeToBackground, encodeToBackground } from "./to-background.ts";
export type {
	CallMessage,
	ErrorMessage,
	ErrorPlace,
	EventMessage,
	HideMessage,
	HydrationMismatch,
	PropsIdDifference,
	PropsIdsMessage,
	ReceivedByBackground,
	ReleaseMessage,
	ReplyMessage,
	RewriteMessage,
	SentEvent,
	SentTarget,
	ShowMessage,
	ThreadEvent,
	ToBackground,
} from "./to-background.ts";
