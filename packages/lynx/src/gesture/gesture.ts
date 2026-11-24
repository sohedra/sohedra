// What `main-thread:gesture` takes: a gesture, which only the gesture classes make.

declare const brand: unique symbol;

/**
 * A gesture: what `main-thread:gesture` takes, and what a gesture's relations name. Only the
 * gesture classes make one.
 */
export interface Gesture {
	/** Marks the type: a gesture is made by a gesture class only. */
	readonly [brand]: true;
}
