// The root component's props in a test, so `rerender(props)` changes them in place, as a parent
// would. The values stay as given: an array a test passes in is the array the component gets (a
// `$state` object would hand it a deep copy behind a proxy).

import { signal } from "../../svelte/runtime/index.ts";

/** The props a component is mounted with, and how a test changes them. */
interface TestProps<Props extends Record<string, unknown>> {
	/** What the component is mounted with: each read follows the latest change. */
	readonly props: Props;
	/** Merges `next` into the props: the component reads the new values. */
	update(next: Partial<Props>): void;
}

/** Props that start as `initial`. */
export function testProps<Props extends Record<string, unknown>>(initial: Props): TestProps<Props> {
	const current = signal<Props>({ ...initial });
	const descriptor = (key: string | symbol): PropertyDescriptor | undefined =>
		key in current.read()
			? {
					configurable: true,
					enumerable: true,
					writable: true,
					value: Reflect.get(current.read(), key),
				}
			: undefined;
	// Boundary: the proxy reads the latest props for every key Svelte asks for.
	const props = new Proxy({} as Props, {
		get: (_target, key) => Reflect.get(current.read(), key),
		has: (_target, key) => key in current.read(),
		ownKeys: () => Reflect.ownKeys(current.read()),
		getOwnPropertyDescriptor: (_target, key) => descriptor(key),
	});
	return {
		props,
		update(next) {
			current.write({ ...current.read(), ...next });
		},
	};
}
