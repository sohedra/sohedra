/**
 * An event passed to a user handler that Sohedra merges with its own. Calling
 * `preventSohedraHandler()` skips Sohedra's handler for this event without calling
 * `preventDefault()`.
 */
export type SohedraEvent<E> = E & {
	preventSohedraHandler: () => void;
	readonly sohedraHandlerPrevented?: boolean | undefined;
};

type WithPreventSohedraHandler<T> = T extends (event: infer E) => infer R
	? (event: SohedraEvent<E>) => R
	: T;

/** Adds `preventSohedraHandler` to the event of every `on*` handler in `T`. */
export type WithSohedraEvent<T> = {
	[K in keyof T]: K extends `on${string}` ? WithPreventSohedraHandler<T[K]> : T[K];
};

/** The axis a component is laid out along. */
export type Orientation = "horizontal" | "vertical";

/** The direction text runs in: left to right, or right to left. */
export type TextDirection = "ltr" | "rtl";
