// The globals of a test process, in one place: the DOM its environment gives, the names a page
// puts on `globalThis`, and the one slot that tells the test setup which page to clean up.

/** What the test environment gives: a DOM, once its preset or `testEnvironment` has set one. */
interface EnvironmentGlobals {
	document?: Document;
	setImmediate: (callback: () => void) => unknown;
}

// Boundary: the test environment's globals have no types of their own; this is the one place
// `globalThis` is typed.
const environment: EnvironmentGlobals = globalThis as unknown as EnvironmentGlobals;

/**
 * Delivers `callback` on a later macrotask. The function is the one the process had when this
 * module loaded: a test that fakes timers must not stop the threads.
 */
export const nextMacrotask: (callback: () => void) => void =
	environment.setImmediate.bind(globalThis);

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

/** What the test setup needs of the page it cleans up. */
export interface ActiveSession {
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
