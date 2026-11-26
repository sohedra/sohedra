/**
 * A `$bindable` prop as a store sees it: read `value`, assign to it to write. A function binding
 * may decline a write, so a store that needs to know reads the value back.
 */
export interface Bound<T> {
	value: T;
}

/**
 * The pair for a `$bindable` prop, made in the part that owns it:
 * `bound(() => checked, (next) => (checked = next))`. `Controllable` takes it as its source.
 */
export function bound<T>(get: () => T, set: (next: T) => void): Bound<T> {
	return {
		get value() {
			return get();
		},
		set value(next) {
			set(next);
		},
	};
}
