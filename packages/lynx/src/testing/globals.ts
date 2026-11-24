// The globals of a test process, in one place: the DOM its environment gives, the names a page
// puts on `globalThis`, and the one slot that tells the test setup which page to clean up.

/** What the test environment gives: a DOM, once its preset or `testEnvironment` has set one. */
interface EnvironmentGlobals {
	document?: Document;
	setImmediate: (callback: () => void) => unknown;
	setTimeout: (callback: () => void, delay: number) => unknown;
	clearTimeout: (timer: unknown) => void;
	process: { nextTick: (callback: () => void) => void };
}

// Boundary: the test environment's globals have no types of their own; this is the one place
// `globalThis` is typed.
const environment: EnvironmentGlobals = globalThis as unknown as EnvironmentGlobals;

/**
 * The process's own microtask queue, as it was when this module loaded: a thread's global
 * `queueMicrotask` is that thread's, and the main thread's is the page's own or none.
 */
const processQueueMicrotask: (callback: () => void) => void =
	globalThis.queueMicrotask.bind(globalThis);

/**
 * The process's own `structuredClone`, as it was when this module loaded: a thread's global one is
 * the binding's fill, or none.
 */
export const processStructuredClone: <T>(value: T) => T =
	globalThis.structuredClone.bind(globalThis);

/**
 * Delivers `callback` on a later macrotask. The function is the one the process had when this
 * module loaded: a test that fakes timers must not stop the threads.
 */
export const nextMacrotask: (callback: () => void) => void =
	environment.setImmediate.bind(globalThis);

const nextTick = environment.process.nextTick.bind(environment.process);

/**
 * Ends the task the test's code runs in: the promise reactions due run, those they queue too, and
 * no later macrotask, so nothing crosses between a page's threads meanwhile. A test ends the task
 * before it runs the other thread's code, as a device ends a thread's task before the thread runs
 * anything else. It starts from a microtask, so the tick comes once every reaction due, and those they
 * queue, has run: from a macrotask's own code, Node runs ticks before the reactions. The tick is
 * the one the process had when this module loaded: a test that fakes timers must not stop it.
 */
export async function endTask(): Promise<void> {
	await Promise.resolve();
	await new Promise<void>((resolve) => nextTick(resolve));
}

/**
 * Runs `callback` once `delay` milliseconds have passed in the process's time, and returns how to
 * stop it. It reads the process's timer when called: a test that fakes timers decides when it runs.
 */
export function afterDelay(callback: () => void, delay: number): () => void {
	const timer = environment.setTimeout(callback, delay);
	return () => environment.clearTimeout(timer);
}

/** The document the page's elements live in; throws when the test environment has none. */
export function testDocument(): Document {
	const document = environment.document;
	if (!document) {
		throw new Error(
			"The test page needs a DOM, and this test environment has none. " +
				"Run the test with `withSvelteLynx()` from `@sohedra/lynx/config/rstest`, " +
				'or set `testEnvironment: "jsdom"`.',
		);
	}
	return document;
}

/** The value of a global, if the process has one. */
export function readGlobal(name: string): unknown {
	// Boundary: any name may be a global.
	return (globalThis as unknown as Record<string, unknown>)[name];
}

/**
 * Puts `values` on `globalThis` and returns how to put the process back: each name goes back to
 * what it was, or is deleted if it was not there. `restore` names more globals to put back: the
 * ones the page's own code sets while it runs.
 */
export function installGlobals(
	values: Readonly<Record<string, unknown>>,
	restore: readonly string[] = [],
): () => void {
	// Boundary: any name may be a global.
	const scope = globalThis as unknown as Record<string, unknown>;
	const saved = new Map<string, PropertyDescriptor | undefined>();
	const remember = (name: string): void => {
		if (!saved.has(name)) saved.set(name, Object.getOwnPropertyDescriptor(scope, name));
	};
	for (const name of restore) remember(name);
	for (const [name, value] of Object.entries(values)) {
		remember(name);
		scope[name] = value;
	}
	return () => {
		for (const [name, descriptor] of saved) {
			if (descriptor) Object.defineProperty(scope, name, descriptor);
			else delete scope[name];
		}
	};
}

/** The process's global object, for a fill that puts its globals there as a thread's does. */
export function globalScope(): Record<string, unknown> {
	// Boundary: any name may be a global.
	return globalThis as unknown as Record<string, unknown>;
}

/** Deletes the globals named `names`: what `installGlobals` saved puts them back at the end. */
export function removeGlobals(names: readonly string[]): void {
	// Boundary: any name may be a global.
	const scope = globalThis as unknown as Record<string, unknown>;
	for (const name of names) delete scope[name];
}

/**
 * Runs `callback` on a microtask, as the thread that queued it: `enter` puts that thread's globals
 * in place and returns what puts back the ones before, so a microtask another thread queued after
 * it finds its own.
 */
export function queueMicrotaskAs(enter: () => () => void, callback: () => void): void {
	processQueueMicrotask(() => {
		const leave = enter();
		try {
			callback();
		} finally {
			leave();
		}
	});
}

/** What the test setup needs of the page it cleans up. */
interface ActiveSession {
	dispose(): void;
}

// A symbol from the registry: the setup file and the test file are bundled apart, and each has its
// own copy of this module, but they share the process.
const ACTIVE = Symbol.for("@sohedra/lynx/testing:active-session");

/** The page that is running now, if any. */
export function activeSession(): ActiveSession | undefined {
	// Boundary: the slot is this module's own symbol on the process's global object.
	return (globalThis as unknown as Record<symbol, ActiveSession | undefined>)[ACTIVE];
}

/** Records the page that is running now, or none. */
export function setActiveSession(session: ActiveSession | undefined): void {
	// Boundary: the slot is this module's own symbol on the process's global object.
	(globalThis as unknown as Record<symbol, ActiveSession | undefined>)[ACTIVE] = session;
}

/** The runners a test library's setup file names. */
type TestRunner = "rstest" | "vitest";

// A symbol from the registry, as for the active session: the setup file says it, the test reads it.
const RUNNER = Symbol.for("@sohedra/lynx/testing:runner");

/** The runner the setup file said the tests run under, if one did. */
export function testRunner(): TestRunner | undefined {
	// Boundary: the slot is this module's own symbol on the process's global object.
	return (globalThis as unknown as Record<symbol, TestRunner | undefined>)[RUNNER];
}

/** Records the runner the tests run under. */
export function setTestRunner(runner: TestRunner): void {
	// Boundary: the slot is this module's own symbol on the process's global object.
	(globalThis as unknown as Record<symbol, TestRunner | undefined>)[RUNNER] = runner;
}
