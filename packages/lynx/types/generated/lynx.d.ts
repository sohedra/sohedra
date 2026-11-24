// Generated from @lynx-js/types 4.4.2 by `pnpm -F @sohedra/lynx generate`. Do not edit:
// change scripts/types/ and generate again. The doc comments are Lynx's, from
// @lynx-js/types (Apache License 2.0).
//
// The global `lynx`, as Lynx declares it for each thread, and the types its members name.

import type { GlobalProps } from "@sohedra/lynx/host";

/** A URL, as lynx-core's `fetch` takes it: its text. */
type URL = string;
/** What lynx-core's `fetch` takes: a URL, or a request. */
type RequestInfo = string | Request;
/** The headers of lynx-core's `fetch`. */
type Headers = Record<string, string>;
type HeadersInit = Record<string, string>;
/** A body lynx-core's `fetch` sends. */
type BodyInit = string | ArrayBuffer;
interface ResponseInit {
	status?: number;
	statusText?: string;
	headers?: HeadersInit;
}
/** A response's body, as lynx-core streams it. */
type ReadableStream = LynxReadableStream<Uint8Array>;
/** An event of lynx-core's `EventSource`. */
interface Event {
	readonly type: string;
}
/** The events of lynx-core's `EventSource`, by name. */
interface EventSourceEventMap {
	error: Event;
	message: MessageEvent;
	open: Event;
}

interface Animation {
	readonly effect: KeyframeEffect;
	readonly id: string;

	cancel(): void;

	pause(): void;

	play(): void;
}

interface AnimationElement {
	// keyframes: see https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Keyframe_Formats
	//  Either an array of keyframe objects, or a keyframe object whose property are arrays of values to iterate over. See Keyframe Formats for more details.
	//
	// timingOptions: see https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
	//  id Optional: A property unique to animate(): a DOMString with which to reference the animation.
	//  delay Optional: The number of milliseconds to delay the start of the animation. Defaults to 0.
	//  direction Optional: Whether the animation runs forwards (normal), backwards (reverse), switches direction after each iteration (alternate), or runs backwards and switches direction after each iteration (alternate-reverse). Defaults to "normal".
	//  duration Optional: The number of milliseconds each iteration of the animation takes to complete. Defaults to 0. Although this is technically optional, keep in mind that your animation will not run if this value is 0.
	//  easing Optional: The rate of the animation's change over time. Accepts the pre-defined values "linear", "ease", "ease-in", "ease-out", and "ease-in-out", or a custom "cubic-bezier" value like "cubic-bezier(0.42, 0, 0.58, 1)". Defaults to "linear".
	//  endDelay Optional: The number of milliseconds to delay after the end of an animation. This is primarily of use when sequencing animations based on the end time of another animation. Defaults to 0.
	//  fill Optional: Dictates whether the animation's effects should be reflected by the element(s) prior to playing ("backwards"), retained after the animation has completed playing ("forwards"), or both. Defaults to "none".
	//  iterationStart Optional: Describes at what point in the iteration the animation should start. 0.5 would indicate starting halfway through the first iteration for example, and with this value set, an animation with 2 iterations would end halfway through a third iteration. Defaults to 0.0.
	// iterations Optional: The number of times the animation should repeat. Defaults to 1, and can also take a value of Infinity to make it repeat for as long as the element exists.
	animate(keyframes: Array<Record<string, any>>, timingOptions: Record<string, any>): Animation;

	playAnimate(ani: Animation): void;

	pauseAnimate(ani: Animation): void;

	cancelAnimate(ani: Animation): void;

	finishAnimate(ani: Animation): void;

	setProperty(propsObj: string | Record<string, string>, propsVal?: string): void;
}

interface AnimationV2 {
	readonly effect: KeyframeEffectV2;
	readonly id: string;
}

type AnyObject = Record<string, any>;

interface BaseNodesRef {
	animate(animations: AnimationV2[] | AnimationV2): SelectorQuery;

	playAnimation(ids: string[] | string): SelectorQuery;

	pauseAnimation(ids: string[] | string): SelectorQuery;

	cancelAnimation(ids: string[] | string): SelectorQuery;

	setNativeProps(nativeProps: Record<string, any>): SelectorQuery;
}

interface BeforePublishEvent extends EventEmitter {
	add(
		eventName: string,
		callback: (...args: unknown[]) => void,
		context?: object,
	): BeforePublishEvent;

	remove(eventName: string, callback: (...args: unknown[]) => void): BeforePublishEvent;
}

/**
 * @description Http Body
 * @since 2.18
 */
interface Body {
	/**
	 * @description body used
	 * @see https://developer.mozilla.org/docs/Web/API/Request/bodyUsed
	 * @since 2.18
	 */
	readonly bodyUsed: boolean;
	/**
	 * @description arrayBuffer()
	 * @see https://developer.mozilla.org/docs/Web/API/Request/arrayBuffer
	 * @since 2.18
	 */
	arrayBuffer(): Promise<ArrayBuffer>;
	/**
	 * @description json()
	 * @see https://developer.mozilla.org/docs/Web/API/Request/json
	 * @since 2.18
	 */
	json(): Promise<any>;
	/**
	 * @description text()
	 * @see https://developer.mozilla.org/docs/Web/API/Request/text
	 * @since 2.18
	 */
	text(): Promise<string>;
}

interface BundleInfo {
	url: string;
	code: number;
	error_msg: string;
}

interface CommonPerformance {
	/**
	 * Support from Lynx 3.0
	 *
	 * Start a performance tracing event.
	 *
	 * @param traceName - The name used to identify the tracing event.
	 * @param option - Optional parameters providing `flowId` and additional context.
	 *
	 * @example
	 * lynx.performance.profileStart("myEvent", { flowId: 123, args: { key: "value" } });
	 */
	profileStart: (traceName: string, option?: TraceOption) => void;

	/**
	 * Support from Lynx 3.0
	 *
	 * End a performance tracing event.
	 *
	 * @example
	 * lynx.performance.profileEnd();
	 */
	profileEnd: () => void;

	/**
	 * Support from Lynx 3.0
	 *
	 * Mark a instant trace event. Can connect with `ProfileStart` trace through `flowId`.
	 * @param traceName - The name used to identify the tracing mark.
	 * @param option - Optional parameters providing `flowId` and additional context.
	 *
	 * @example
	 * lynx.performance.profileMark("myMark", { args: { key: "value" }, flowId:123 });
	 */
	profileMark: (traceName: string, option?: TraceOption) => void;

	/**
	 * Support from Lynx 3.0
	 *
	 * Generate a unique flow identifier.
	 *
	 * @returns A unique numerical identifier for tracing event flows.
	 *
	 * @example
	 * const flowId = lynx.performance.profileFlowId();
	 */
	profileFlowId: () => number;

	/**
	 * Support from Lynx 2.18
	 *
	 * Check if the current device is recording trace data.
	 *
	 * @returns A boolean indicating whether the device is currently recording trace data.
	 *
	 * @example
	 * const isRecording = lynx.performance.isProfileRecording();
	 */
	isProfileRecording: () => boolean;
}

interface ContextProxy {
	onTriggerEvent?: (event: MessageEvent) => void;

	postMessage(message: any): void;
	dispatchEvent(event: MessageEvent): DispatchEventResult;
	addEventListener(type: string, listener: (event: MessageEvent) => void): void;
	removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
}

/**
 * Makes an observer of where elements are against the page or the screen. Pass `{}`: a Svelte
 * page has no components of Lynx's own, and `{}` observes the whole page.
 */
type CreateIntersectionObserverFunc = (
	component: { componentId?: string },
	options?: { thresholds?: number[]; initialRatio?: number; observeAll?: boolean },
) => IntersectionObserver;

type DispatchEventResult =
	// 'NotCanceled'
	// Event was not canceled by event handler or default event handler.
	| 0
	// 'CanceledByEventHandler'
	// Event was canceled by event handler; i.e. a script handler calling
	// preventDefault.
	| 1
	// 'CanceledByDefaultEventHandler'
	// Event was canceled by the default event handler; i.e. executing the default
	// action.  This result should be used sparingly as it deviates from the DOM
	// Event Dispatch model. Default event handlers really shouldn't be invoked
	// inside of dispatch.
	| 2
	// 'CanceledBeforeDispatch'
	// Event was canceled but suppressed before dispatched to event handler.  This
	// result should be used sparingly; and its usage likely indicates there is
	// potential for a bug. Trusted events may return this code; but untrusted
	// events likely should always execute the event handler the developer intends
	// to execute.
	| 3;

interface EventEmitter {
	addListener(eventName: string, listener: (...args: unknown[]) => void, context?: object): void;

	removeListener(eventName: string, listener: (...args: unknown[]) => void): void;

	emit(eventName: string, data: unknown): void;

	removeAllListeners(eventName?: string): void;

	trigger(eventName: string, params: string | Record<any, any>): void;

	toggle(eventName: string, ...data: unknown[]): void;
}

/**
 * @description EventSource to support SSE protocol
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource
 * @since 3.5
 */
interface EventSource {
	new (url: string | URL, options?: RequestInit): EventSource;

	/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/error_event) */
	onerror: ((this: EventSource, ev: Event) => any) | null;
	/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/message_event) */
	onmessage: ((this: EventSource, ev: MessageEvent) => any) | null;
	/**
	 * The **`close()`** method of the EventSource interface closes the connection, if one is made, and sets the ```js-nolint close() ``` None.
	 *
	 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/close)
	 */
	close(): void;
	addEventListener<K extends keyof EventSourceEventMap>(
		type: K,
		listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
	): void;
	addEventListener(type: string, listener: (event: MessageEvent) => void): void;
	removeEventListener<K extends keyof EventSourceEventMap>(
		type: K,
		listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
	): void;
	removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
}

interface ExtraTimingInfo {
	prepare_template_start?: number;
	prepare_template_end?: number;
	container_init_start?: number;
	container_init_end?: number;
	open_time?: number;
	[key: string]: unknown;
}

interface FieldsData {
	id: string;
	tag: string;
	dataset: Record<string, unknown>;
	index: number;
	class: Array<string>;
	attribute: Record<string, unknown>;
	query: SelectorQuery;
}

interface FieldsParams {
	id?: boolean;
	dataset?: boolean;
	tag?: boolean;
	index?: boolean;
	class?: boolean;
	attribute?: boolean;
	query?: boolean;
}

interface FontFace {
	"font-family": string;
	src: string;
}

type GetElementByIdFunc = (id: string) => AnimationElement;

type GlobalEventEmitter = EventEmitter;

interface IntersectionObserver {
	relativeTo(selector: string, margins?: RelativeToMargins): IntersectionObserver;

	relativeToViewport(margins?: RelativeToViewportMargins): IntersectionObserver;

	relativeToScreen(margins?: RelativeToViewportMargins): IntersectionObserver;

	observe(selector: string, callback: ObserveCallback): void;

	disconnect(): void;

	invokeCallback(callbackId: number, data: Record<string, any>): void;
}

interface KeyframeEffect {
	readonly target: AnimationElement;
	readonly keyframes: Array<Record<string, any>>;
	readonly options: Record<string, any>;
}

interface KeyframeEffectV2 {
	readonly keyframes: Array<Record<string, any>>;
	readonly options: Record<string, any>;
}

interface LoadDynamicComponentFailedResult {
	// E_DYNAMIC_COMPONENT_LOAD_BAD_RESPONSE = 160102,
	// E_DYNAMIC_COMPONENT_LOAD_EMPTY_FILE = 160102,
	// E_DYNAMIC_COMPONENT_LOAD_DECODE_FAIL = 160103,
	code: 160101 | 160102 | 160103;
	detail?: {
		url: string;
		errMsg: string;
	};
}

type LoadDynamicComponentFunc = {
	(
		url: string,
		options?: Record<string, any>,
	): Promise<LoadDynamicComponentSuccessResult | LoadDynamicComponentFailedResult>;
	(
		id: string | string[],
		url: string,
		options?: Record<string, any>,
	): Promise<LoadDynamicComponentSuccessResult | LoadDynamicComponentFailedResult>;
};

interface LoadDynamicComponentSuccessResult {
	code: 0;
	detail?: {
		schema: string;
		errMsg: "";
		cache: boolean;
	};
}

interface LynxExtension {
	useStreaming?: boolean;
	/**
	 * @description Sets the total request timeout in milliseconds for internal TTNet builds. The value must be an integer from 1,000 through 600,000. If omitted or invalid, the network stack's default timeout behavior is preserved.
	 * @since 4.4
	 */
	requestTimeoutMs?: number;
}

interface LynxReadableStream<T = ArrayBuffer> {
	readonly locked: boolean;
	cancel(reason?: any): Promise<any>;
	getReader(): LynxReadableStreamDefaultReader<T> | null;
}

interface LynxReadableStreamDefaultReader<T = ArrayBuffer> {
	read(): Promise<LynxReadableStreamReadResult<T>>;
	cancel(reason?: any): Promise<any>;
}

interface LynxReadableStreamReadResult<T = ArrayBuffer> {
	done: boolean;
	value: T | undefined;
}

/**
 * A best-effort snapshot of the current page's memory usage.
 *
 * Always require `status === MemoryUsageQueryStatus.OK` before reading the
 * other properties. Even with `OK`, unsupported, unavailable or failed sources
 * are returned as zero. A numeric field is consumable only when its value is
 * greater than zero.
 */
interface MemoryUsage {
	/** The query result. Check this before using any other property. */
	status: MemoryUsageQueryStatus;
	/**
	 * The sum of the available page-attributed components: `elementBytes`,
	 * `mtsBytes`, `btsBytes`, and `uiBytes`.
	 *
	 * This value can be incomplete even when `status` is `OK`:
	 *
	 * - UI memory is included only when UI memory sampling is enabled and the
	 *   current process is selected.
	 * - MTS memory is included only for a QuickJS-backed MTS runtime.
	 * - For a non-shared BTS VM, BTS memory is included when the VM heap size is
	 *   available.
	 * - For a shared BTS VM, BTS memory is included only for QuickJS with a valid
	 *   per-page memory slot. Slots 0-2 are reserved, so one VM can attribute at
	 *   most 253 page allocations over its lifetime. Additional pages use the
	 *   shared overflow slot and cannot report page-specific BTS memory.
	 *
	 * `btsHeapBytes` is not added separately. For a shared VM it describes the
	 * whole VM rather than this page. Consume this field only when it is greater
	 * than zero.
	 */
	totalBytes: number;
	/** Page element memory in bytes. Consume only when greater than zero. */
	elementBytes: number;
	/** Number of page elements. Consume only when greater than zero. */
	elementCount: number;
	/**
	 * Page MTS heap memory in bytes. It is available only for a QuickJS-backed
	 * MTS runtime. Consume only when greater than zero.
	 */
	mtsBytes: number;
	/**
	 * Page-attributed BTS memory in bytes. For a non-shared BTS VM this is its
	 * available whole heap. For a shared VM this is available only from a valid
	 * QuickJS per-page memory slot. Consume only when greater than zero.
	 */
	btsBytes: number;
	/**
	 * The whole BTS VM heap in bytes. For a shared VM this includes other pages
	 * and VM-wide memory and is not the current page's BTS usage. It can be
	 * available while `btsBytes` and its contribution to `totalBytes` are not. It
	 * is zero when the runtime cannot provide a heap size, including JSC, or
	 * collection fails. Consume only when greater than zero.
	 */
	btsHeapBytes: number;
	/**
	 * Page UI memory in bytes. It is available only when UI memory sampling is
	 * enabled and the current process is selected. Consume only when greater than
	 * zero.
	 */
	uiBytes: number;
	/**
	 * Whether this page uses a shared BTS VM. Valid only when `status` is `OK`;
	 * `true` does not imply that `btsBytes` is available.
	 */
	btsShared: boolean;
}

declare enum MemoryUsageQueryStatus {
	/**
	 * Monitoring is enabled, the instance was found, and a best-effort memory
	 * collection was performed. This does not guarantee a complete or fresh
	 * snapshot.
	 */
	OK = 0,
	/** Memory monitoring is disabled. */
	MONITORING_DISABLED = 1,
	/** The instance does not exist or has already been destroyed. */
	INVALID_INSTANCE = 2,
}

interface MessageEvent {
	type: string;
	data: any;
	origin?: string;
}

interface MetricsTimingInfo {
	tti?: number;
	lynx_tti?: number;
	total_tti?: number;
	fcp?: number;
	lynx_fcp?: number;
	total_fcp?: number;
	actual_fmp?: number;
	lynx_actual_fmp?: number;
	total_actual_fmp?: number;
	[key: string]: unknown;
}

interface MultiNodesRef extends BaseNodesRef {
	path(callback: (data: PathData[], status: { data: string; code: number }) => void): SelectorQuery;

	fields<T extends FieldsParams>(
		fields: Required<FieldsParams> extends Record<keyof T, boolean> ? T : FieldsParams,
		callback: (
			data: {
				[K in keyof Required<FieldsParams> as T[K] extends true ? K : never]: FieldsData[K];
			}[],
			status: { data: string; code: number },
		) => void,
	): SelectorQuery;
}

declare enum NODE_REF_INVOKE_ERROR_CODE {
	SUCCESS = 0,
	UNKNOWN = 1,
	NODE_NOT_FOUND = 2,
	METHOD_NOT_FOUND = 3,
	PARAM_INVALID = 4, // Determined by the implementer of the component.
	SELECTOR_NOT_SUPPORTED = 5, // Currently only supports ID selectors.
}

interface NodesRef extends BaseNodesRef {
	invoke(options: uiMethodOptions): SelectorQuery;

	path(callback: PathCallback): SelectorQuery;

	fields<T extends FieldsParams>(
		fields: Required<FieldsParams> extends Record<keyof T, boolean> ? T : FieldsParams,
		callback: (
			data:
				| {
						[K in keyof Required<FieldsParams> as T[K] extends true ? K : never]: FieldsData[K];
				  }
				| null,
			status: { data: string; code: number },
		) => void,
	): SelectorQuery;
}

type ObserveCallback = (result: ObserveCallbackResult) => void;

interface ObserveCallbackResult {
	isIntersecting: boolean;
	intersectionRatio: number;
	intersectionRect: RectResult;
	boundingClientRect: RectResult;
	relativeRect: RectResult;
	observerId: string;
	time: number;
}

type PathCallback = (data: PathData | null, status: { data: string; code: number }) => void;

interface PathData {
	data: Array<{
		tag: string;
		id: string;
		class: string[];
		dataSet: Record<string, unknown>;
		// index of parent's children
		index: number;
	}>;
}

interface Performance extends CommonPerformance {
	addTimingListener(listener: TimingListener): void;
	removeTimingListener(listener: TimingListener): void;
	removeAllTimingListener(): void;
	createObserver(callback: PerformanceCallback): PerformanceObserver;
	/**
	 * Asynchronously reads a best-effort current page memory snapshot. Always
	 * check `MemoryUsage.status` before using the returned memory fields.
	 */
	getMemoryUsage(callback: (usage: MemoryUsage) => void): void;
}

type PerformanceCallback = (entry: PerformanceEntry) => void;

interface PerformanceEntry {
	name: string;
	entryType: string;
	typeResolved: boolean;
}

interface PerformanceObserver {
	observe(name: string[]): void;
	disconnect(): void;
	onPerformanceEvent(entry: PerformanceEntry): void;
}

interface RectResult {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

interface RelativeToMargins {
	bottom?: number;
	left?: number;
	right?: number;
	top?: number;
}

interface RelativeToViewportMargins {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

/**
 * @description This Fetch API interface represents a resource request.
 * @see https://developer.mozilla.org/docs/Web/API/Request
 * @since 2.18
 */
interface Request extends Body {
	/**
	 * @description Returns a Headers object consisting of the headers associated with request. Note that headers added in the network layer by the user agent will not be accounted for in this object, e.g., the "Host" header.
	 * @see https://developer.mozilla.org/docs/Web/API/Request/headers
	 * @since 2.18
	 */
	readonly headers: Headers;
	/**
	 * @description Returns request's HTTP method, which is "GET" by default.
	 * @see https://developer.mozilla.org/docs/Web/API/Request/method
	 * @since 2.18
	 */
	readonly method: string;
	/**
	 * @description Returns the URL of request as a string.
	 * @see https://developer.mozilla.org/docs/Web/API/Request/url
	 * @since 2.18
	 */
	readonly url: string;
	/**
	 * @description clone()
	 * @see https://developer.mozilla.org/docs/Web/API/Request/clone
	 * @since 2.18
	 */
	clone(): Request;
}

/**
 * @description This Fetch API interface represents the response to a request.
 * @see https://developer.mozilla.org/docs/Web/API/Response
 * @since 2.18
 */
interface RequestInit {
	/**
	 * @description A BodyInit object or null to set request's body.
	 * @since 2.18
	 */
	body?: BodyInit | null;
	/**
	 * @description A Headers object, an object literal, or an array of two-item arrays to set request's headers.
	 * @since 2.18
	 */
	headers?: HeadersInit;
	/**
	 * @description A string to set request's method.
	 * @since 2.18
	 */
	method?: string;
	/**
	 * @description Lynx-specific fetch options.
	 * @since 3.4
	 */
	lynxExtension?: LynxExtension;
}

interface ResourcePrefetchConfig {
	awaitComplete?: boolean;
	awaitTimeout?: number; // default is 60000ms
}

interface ResourcePrefetchData {
	data: {
		uri: string;
		type: "image" | "video" | "font";
		param?: {
			priority?: "high" | "medium" | "low";
			cacheTarget?: "disk" | "bitmap";
			preloadKey?: string;
			size: number;
		};
	}[];
}

interface ResourcePrefetchResult {
	code: number;
	msg: string;
	details: {
		code: number;
		msg: string;
		uri: string;
		type: "image" | "video";
	}[];
}

/**
 * @description This Fetch API interface represents the response to a request.
 * @see https://developer.mozilla.org/docs/Web/API/Response
 * @since 2.18
 */
interface Response extends Body {
	/**
	 * @description headers
	 * @see https://developer.mozilla.org/docs/Web/API/Response/headers
	 * @since 2.18
	 */
	readonly headers: Headers;
	/**
	 * @description ok
	 * @see https://developer.mozilla.org/docs/Web/API/Response/ok
	 * @since 2.18
	 */
	readonly ok: boolean;
	/**
	 * @description status
	 * @see https://developer.mozilla.org/docs/Web/API/Response/status
	 * @since 2.18
	 */
	readonly status: number;
	/**
	 * @description statusText
	 * @see https://developer.mozilla.org/docs/Web/API/Response/statusText
	 * @since 2.18
	 */
	readonly statusText: string;
	/**
	 * @description url
	 * @see https://developer.mozilla.org/docs/Web/API/Response/url
	 * @since 2.18
	 */
	readonly url: string;
	/**
	 * @description body of ReadableStream
	 * @see https://developer.mozilla.org/docs/Web/API/Response/body
	 * @since 3.4
	 */
	readonly body: ReadableStream;
	/**
	 * @description clone()
	 * @see https://developer.mozilla.org/docs/Web/API/Response/clone
	 * @since 2.18
	 */
	clone(): Response;
}

interface ResponseHandler {
	/**
	 * Synchronously block until the bundle resolves, with a timeout in
	 * SECONDS. Returns the resolved {@link BundleInfo}; on timeout the
	 * returned info has a non-zero `code`.
	 */
	wait: (timeout: number) => BundleInfo;
	/**
	 * Register a callback to receive the resolved {@link BundleInfo} when
	 * the fetch completes (asynchronously).
	 *
	 * Note: this is NOT a standard Promise `then` — it accepts a single
	 * callback and does not return a chainable thenable. Use the platform
	 * adapter to wrap it in a real Promise if needed.
	 */
	then: (callback: (info: BundleInfo) => void) => void;
}

interface SelectorQuery {
	/**
	 * Selects a single node by CSS selector.
	 * @param selector CSS selector
	 */
	select(selector: string): NodesRef;

	/**
	 * Selects all nodes satisfying CSS selector.
	 * @param selector CSS selector
	 */
	selectAll(selector: string): MultiNodesRef;

	/**
	 * Select root node of the component.
	 */
	selectRoot(): NodesRef;

	// /**
	//  * Selects a single node by element id.
	//  * When a touch event is triggered, the element id of the node is passed to the event handler as 'uid',
	//  * by which can a node be selected in its event handler.
	//  */
	// selectUniqueID(uniqueId: string | number): NodesRef;

	/**
	 * Execute all tasks in the task queue.
	 * When `this._fire_immediately` is set to true, this method is called automatically.
	 */
	exec(): void;
}

interface SetupTimingInfo {
	create_lynx_start: number;
	create_lynx_end: number;
	load_core_start: number;
	load_core_end: number;
	load_app_start: number;
	load_app_end: number;
	load_template_start: number;
	load_template_end: number;
	decode_start: number;
	decode_end: number;
	lepus_excute_start: number;
	lepus_excute_end: number;
	set_init_data_start: number;
	set_init_data_end: number;
	data_processor_start: number;
	data_processor_end: number;
	create_vdom_start: number;
	create_vdom_end: number;
	dispatch_start: number;
	dispatch_end: number;
	layout_start: number;
	layout_end: number;
	ui_operation_flush_start: number;
	ui_operation_flush_end: number;
	draw_end: number;
	[key: string]: unknown;
}

interface TextInfo {
	fontSize: string;
	fontFamily?: string;
	maxWidth?: string;
	maxLine?: number;
}

interface TextMetrics {
	width: number;
	content?: Array<string>;
}

interface TimingInfo {
	extra_timing: ExtraTimingInfo;
	setup_timing: SetupTimingInfo;
	update_timings: {
		[key: string]: UpdateTimingInfo;
	};
	metrics: MetricsTimingInfo;
	has_reload: boolean;
	thread_strategy: number;
	url: string;
	[key: string]: unknown;
}

interface TimingListener {
	onSetup: (info: TimingInfo) => void;
	onUpdate: (info: TimingInfo) => void;
}

/**
 * Support from Lynx 3.0
 */
interface TraceOption {
	/**
	 * An optional unique identifier for tracing a single event flow.
	 *
	 * Note: If `flowIds` is set, this parameter will be ignored.
	 */
	flowId?: number | undefined;

	/**
	 * An optional unique identifier for tracing multiple event flows.
	 * Support from Lynx 3.5
	 */
	flowIds?: number[];

	/**
	 * An optional collection of key-value pairs providing additional context for the tracing event.
	 */
	args?: Record<string, string>;
}

interface UpdateTimingInfo {
	set_state_trigger?: number;
	create_vdom_start?: number;
	create_vdom_end?: number;
	dispatch_start?: number;
	dispatch_end?: number;
	layout_start?: number;
	layout_end?: number;
	ui_operation_flush_start?: number;
	ui_operation_flush_end?: number;
	draw_end: number;
	[key: string]: unknown;
}

interface uiMethodOptions {
	method: string;
	params?: AnyObject;
	success?(res: any): void;
	fail?(res: { code: NODE_REF_INVOKE_ERROR_CODE; data?: any }): void;
}

declare global {
	/**
	 * Lynx's `lynx` object: what each thread has of it, as Lynx declares it. Each member says which
	 * thread has it; the build reports a member read on a thread without it. Add to it, as
	 * `declare global { interface Lynx { … } }`, for a member a newer Lynx has.
	 */
	interface Lynx {
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description Properties inside `lynx.__globalProps` is NOT managed by Lynx, so you MUST extends this interface yourself
		 * @see https://www.typescriptlang.org/docs/handbook/declaration-merging.html
		 */
		__globalProps: GlobalProps;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		__presetData: Record<string, unknown>;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description Dynamic add font
		 * @since 2.12
		 */
		addFont(fontFace: FontFace, callback?: () => void): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		beforePublishEvent: BeforePublishEvent;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		cancelResourcePrefetch(
			data: ResourcePrefetchData,
			callback: (res: ResourcePrefetchResult) => void,
		): void;
		/**
		 * In a Svelte app, pass `{}` for the component: `lynx.createIntersectionObserver({})`.
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		createIntersectionObserver: CreateIntersectionObserverFunc;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		createSelectorQuery(): SelectorQuery;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description EventSource to support SSE protocol
		 * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource
		 * @since 3.5
		 */
		EventSource: EventSource;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description subset of Fetch API
		 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
		 * @since 2.18
		 */
		fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		fetchBundle(url: string, options?: {}): ResponseHandler;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getCoreContext(): ContextProxy;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getDevtool(): ContextProxy;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		getElementById: GetElementByIdFunc;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getEngine(): ContextProxy;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getJSContext(): ContextProxy;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		getJSModule<Module = unknown>(name: string): Module;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		getJSModule(name: "GlobalEventEmitter"): GlobalEventEmitter;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getNative(): ContextProxy;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		getSharedData<T = unknown>(dataKey: string): T;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getTextInfo(text: string, info: TextInfo): TextMetrics;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		getUIContext(): ContextProxy;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		loadDynamicComponent: LoadDynamicComponentFunc;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 * @description Synchronously evaluate a customSection inside a bundle
		 * previously fetched by {@link CommonLynx.fetchBundle}, identified by
		 * the bundle's URL via `options.bundleName`. Returns the section's
		 * `module.exports`.
		 * @since LynxSDK 3.7
		 */
		loadScript<T = unknown>(sectionName: string, options?: { bundleName?: string }): T;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description Callback when an error occurs
		 * @since 1.0
		 */
		onError?: (error: Error) => void;
		/**
		 * Support from Lynx 3.0
		 *
		 * Both threads; the main thread's has only what `CommonPerformance` has.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts` and `types/main-thread/lynx.d.ts`.
		 */
		performance: CommonPerformance & Partial<Omit<Performance, keyof CommonPerformance>>;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description queue microtask
		 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask
		 * @since 3.1
		 */
		queueMicrotask(callback: () => void): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description app-scoped ReadableStream constructor
		 */
		ReadableStream: {
			new (): LynxReadableStream;
		};
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		registerModule<Module extends object>(name: string, module: Module): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		registerSharedDataObserver<T>(callback: (data: T) => void): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		reload(value: object, callback: () => void): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		removeSharedDataObserver<T>(callback: (data: T) => void): void;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 * @description proactively report error
		 * @param error errorInfo
		 * @param options level warning or error
		 * @since main-thread:3.0; background-thread:2.3;
		 */
		reportError(error: string | Error, options?: { level?: "error" | "warning" }): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		requestResourcePrefetch(
			data: ResourcePrefetchData,
			callback: (res: ResourcePrefetchResult) => void,
			config?: ResourcePrefetchConfig,
		): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 * @description requireModule
		 * @param path: the source's path
		 * @param entryName: the resource's entry's name
		 * @param options(@since 3.2): timeout is waiting time,the unit is seconds
		 * @since 1.0
		 */
		requireModule<T>(path: string, entryName?: string, options?: { timeout: number }): T;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		requireModuleAsync<T>(path: string, callback: (error: Error | null, exports?: T) => void): void;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		resumeExposure(): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		setObserverFrameRate(options?: { forPageRect?: number; forExposureCheck?: number }): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		setSharedData<T>(dataKey: string, dataVal: T): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		startRecording(value: object): void;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 */
		stopExposure(options?: { sendEvent: boolean }): void;
		/**
		 * Background thread only.
		 * Lynx's declaration: `@lynx-js/types`, `types/background-thread/lynx.d.ts`.
		 */
		stopRecording(value: object): void;
		/**
		 * Both threads.
		 * Lynx's declaration: `@lynx-js/types`, `types/common/lynx.d.ts`.
		 * @description get project's targetSdkVersion config.
		 * @since main-thread:3.0, background-thread: 2.6
		 */
		targetSdkVersion?: string;
	}

	/** Lynx's `lynx` object. Both threads. */
	var lynx: Lynx;
}

export {};
