// The objects Lynx hands the main thread are the engine's own: an event, its targets and `detail`,
// and `runWorklet`'s options. On Android they have no prototype, and `Reflect.get` on one throws
// "TypeError: not an object", while a plain property read of the same field works (Lynx 4.2 on
// Android 16). There `elementRefptr` also reads as `typeof "unknown"`, a native handle, which the
// fake does not model: it hands the element itself. iOS is not verified.
//
// JavaScript gives a fake object no way to tell `Reflect.get` from a property read: both reach the
// same trap with the same receiver. So the fake makes such objects without a prototype, and while it
// runs the page's main-thread code, it makes `Reflect.get` refuse them.

/** The objects the fake made as the engine's own. */
const made = new WeakSet<object>();

/** The fields of an object that are engine objects too, when they are objects. */
const NESTED = ["target", "currentTarget", "detail"];

/**
 * An engine object with `fields`: no prototype, and refused by `Reflect.get` inside
 * `asEngineCall`. Its `target`, `currentTarget` and `detail` become engine objects too.
 */
export function engineObject<T extends object>(fields: T): T {
	const value = Object.assign(Object.create(null) as T, fields);
	for (const key of NESTED) {
		const field: unknown = (value as Record<string, unknown>)[key];
		if (typeof field === "object" && field !== null && !Array.isArray(field))
			(value as Record<string, unknown>)[key] = engineObject(field);
	}
	made.add(value);
	return value;
}

/** How many engine calls are running, one inside another. */
let depth = 0;
const reflectGet = Reflect.get;

/** `Reflect.get` as Android's engine has it, for the objects the engine made. */
function refusingGet(...args: Parameters<typeof Reflect.get>): unknown {
	if (made.has(args[0])) throw new TypeError("not an object");
	return reflectGet(...args);
}

/** Runs `call`, the engine calling into the page's main-thread code. */
export function asEngineCall<T>(call: () => T): T {
	if (depth++ === 0) Object.defineProperty(Reflect, "get", { value: refusingGet });
	try {
		return call();
	} finally {
		if (--depth === 0) Object.defineProperty(Reflect, "get", { value: reflectGet });
	}
}
