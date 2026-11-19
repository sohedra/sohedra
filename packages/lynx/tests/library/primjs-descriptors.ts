// What PrimJS (Lynx's background on Android, and on iOS hosts that use it) does to a Proxy's
// property descriptor, in Node: an accessor the trap gave comes back as a data descriptor,
// `{ value: undefined, writable: false }`, and its `set` is lost. A module that took
// `Object.getOwnPropertyDescriptor` as it loaded (Svelte's `get_descriptor`) keeps the real one:
// install this before it loads (`rs.resetModules()`, then import it).

/** Makes a Proxy describe its accessors as PrimJS does; returns what puts everything back. */
export function emulatePrimJSDescriptors(): () => void {
	const proxies = new WeakSet<object>();

	const RealProxy = globalThis.Proxy;
	const objectDescriptor = Object.getOwnPropertyDescriptor;
	const reflectDescriptor = Reflect.getOwnPropertyDescriptor;
	const objectDescriptors = Object.getOwnPropertyDescriptors;

	/** An accessor of a recorded proxy, as PrimJS returns it. */
	const asPrimJS = (target: unknown, descriptor: PropertyDescriptor | undefined) => {
		if (descriptor === undefined || typeof target !== "object" || target === null)
			return descriptor;
		if (!proxies.has(target) || !("get" in descriptor || "set" in descriptor)) return descriptor;
		const { enumerable, configurable } = descriptor;
		return { value: undefined, writable: false, enumerable, configurable };
	};

	// A function a caller can `new`: `new RecordingProxy(...)` is the proxy it returns.
	const RecordingProxy = function (target: object, handler: ProxyHandler<object>) {
		const proxy = new RealProxy(target, handler);
		proxies.add(proxy);
		return proxy;
	} as unknown as ProxyConstructor;
	RecordingProxy.revocable = (target, handler) => {
		const { proxy, revoke } = RealProxy.revocable(target, handler);
		proxies.add(proxy);
		return { proxy, revoke };
	};

	globalThis.Proxy = RecordingProxy;
	Object.getOwnPropertyDescriptor = (target: object, key: PropertyKey) =>
		asPrimJS(target, objectDescriptor(target, key));
	Reflect.getOwnPropertyDescriptor = (target: object, key: PropertyKey) =>
		asPrimJS(target, reflectDescriptor(target, key));
	Object.getOwnPropertyDescriptors = ((target: object) => {
		const all = objectDescriptors(target) as Record<PropertyKey, PropertyDescriptor>;
		for (const key of Reflect.ownKeys(all)) all[key] = asPrimJS(target, all[key])!;
		return all;
	}) as typeof Object.getOwnPropertyDescriptors;

	return () => {
		globalThis.Proxy = RealProxy;
		Object.getOwnPropertyDescriptor = objectDescriptor;
		Reflect.getOwnPropertyDescriptor = reflectDescriptor;
		Object.getOwnPropertyDescriptors = objectDescriptors;
	};
}
