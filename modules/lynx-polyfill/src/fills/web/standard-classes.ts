// The web's classes as types: what the fills check a thread's own against and build on, as
// TypeScript's DOM library declares them. Types only. Lint reads `typeof` of a global as a use of
// it, and this folder uses no global by name, so the types are named here once.

/* oxlint-disable no-undef -- types only: nothing here reads a global at run time. */
export type AbortControllerClass = typeof AbortController;
export type AbortSignalClass = typeof AbortSignal;
export type BlobClass = typeof Blob;
export type CompressionStreamClass = typeof CompressionStream;
export type CustomEventClass = typeof CustomEvent;
export type DecompressionStreamClass = typeof DecompressionStream;
export type ErrorEventClass = typeof ErrorEvent;
export type EventClass = typeof Event;
export type EventSourceClass = typeof EventSource;
export type EventTargetClass = typeof EventTarget;
export type FetchFunction = typeof fetch;
export type FileClass = typeof File;
export type FormDataClass = typeof FormData;
export type HeadersClass = typeof Headers;
export type MessageChannelClass = typeof MessageChannel;
export type MessageEventClass = typeof MessageEvent;
export type MessagePortClass = typeof MessagePort;
export type PerformanceClass = typeof Performance;
export type PerformanceEntryClass = typeof PerformanceEntry;
export type PerformanceMarkClass = typeof PerformanceMark;
export type PerformanceMeasureClass = typeof PerformanceMeasure;
export type PromiseRejectionEventClass = typeof PromiseRejectionEvent;
export type ReadableStreamClass = typeof ReadableStream;
export type RequestClass = typeof Request;
export type ResponseClass = typeof Response;
export type TextDecoderClass = typeof TextDecoder;
export type TextDecoderStreamClass = typeof TextDecoderStream;
export type TextEncoderClass = typeof TextEncoder;
export type TextEncoderStreamClass = typeof TextEncoderStream;
export type TransformStreamClass = typeof TransformStream;
export type WritableStreamClass = typeof WritableStream;
export type URLClass = typeof URL;
export type URLPatternClass = typeof URLPattern;
export type URLSearchParamsClass = typeof URLSearchParams;
/* oxlint-enable no-undef */
