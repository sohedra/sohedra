// The animations running on the page's elements, by name, as far as the main thread knows: those
// started and not ended from code. When the main thread lets go of an element, the engine cancels
// them (core/animation/animation.cc, Animation::Destroy) and tells the element's `animationcancel`
// listeners, which are gone by then; the background still waits on their `finished`.

/**
 * The operations of `__ElementAnimate` that start and end an animation
 * (core/runtime/js/bindings/java_script_element.h).
 */
const START = 0;
const CANCEL = 3;
const FINISH = 4;

/** The animations of a page's elements. */
export interface Animations {
	/** `__ElementAnimate` ran on the element with these arguments: `[operation, name, …]`. */
	animated(id: number, args: unknown[]): void;
	/**
	 * Tells the element's `animationcancel` listener that each of its animations is canceled, as
	 * the engine would. One that ended by itself was heard already, and its listener ignores this.
	 */
	cancel(id: number, listener: ((event: unknown) => void) | undefined): void;
	/** The element is gone. */
	forget(id: number): void;
}

/** The animations of one page's elements. */
export function createAnimations(): Animations {
	const running = new Map<number, Set<string>>();
	return {
		animated(id, [operation, name]) {
			if (typeof name !== "string") return;
			let names = running.get(id);
			if (operation === START) {
				if (!names) running.set(id, (names = new Set()));
				names.add(name);
			} else if (operation === CANCEL || operation === FINISH) {
				names?.delete(name);
			}
		},
		cancel(id, listener) {
			if (!listener) return;
			for (const name of running.get(id) ?? [])
				listener({ type: "animationcancel", params: { animation_name: name } });
		},
		forget: (id) => void running.delete(id),
	};
}
