// What the engine's tests share: an engine for each test, taken down after it, and a small page.

import { afterEach, beforeEach } from "@rstest/core";

import { installGlobals } from "../../../../src/testing/globals.ts";
import { createEngine } from "../../../../src/testing/index.ts";
import type { Engine, LynxElement } from "../../../../src/testing/index.ts";

/** An engine made before each test in the calling `describe` and disposed after it. */
export function engineForEach(): () => Engine {
	const running: Engine[] = [];
	beforeEach(() => {
		running.push(createEngine());
	});
	afterEach(() => {
		running.pop()?.dispose();
	});
	return () => running.at(-1)!;
}

/** A page with an `outer` view and an `inner` view in it, each with an id. */
export interface SmallPage {
	page: LynxElement;
	outer: LynxElement;
	inner: LynxElement;
}

/** page > outer > inner, with the ids `outer` and `inner`. */
export function smallPage(engine: Engine): SmallPage {
	const f = engine.functions;
	const page = f.__CreatePage("0", 0);
	const outer = f.__CreateView(0);
	const inner = f.__CreateView(0);
	f.__SetID(outer, "outer");
	f.__SetID(inner, "inner");
	f.__AppendElement(page, outer);
	f.__AppendElement(outer, inner);
	return { page, outer, inner };
}

/** One call the engine made to the global `runWorklet`. */
export interface WorkletCall {
	value: unknown;
	params: unknown[];
	options: unknown;
}

/** What `runWorkletRecorder` gives a test. */
export interface WorkletRecorder {
	/** Every call, in order. */
	calls: WorkletCall[];
	/** What the recorder returns for a function value, by identity. */
	returns: Map<unknown, unknown>;
	/** Replaces the recorder with a function of the test's own. */
	use(run: (value: unknown, params: unknown[], options: unknown) => unknown): void;
	/** Takes the global away: the engine then runs nothing. */
	remove(): void;
}

/**
 * Installs a global `runWorklet` that records each call, before each test in the calling
 * `describe`, and puts the process back after it: the engine knows main-thread functions only by
 * this global.
 */
export function runWorkletRecorder(): WorkletRecorder {
	const recorder: WorkletRecorder = {
		calls: [],
		returns: new Map(),
		use: () => {},
		remove: () => {},
	};
	let restore: (() => void) | undefined;
	const install = (run: (value: unknown, params: unknown[], options: unknown) => unknown) => {
		restore?.();
		restore = installGlobals({ runWorklet: run });
	};
	beforeEach(() => {
		recorder.calls = [];
		recorder.returns = new Map();
		recorder.use = install;
		recorder.remove = () => {
			restore?.();
			restore = undefined;
		};
		install((value, params, options) => {
			recorder.calls.push({ value, params, options });
			return recorder.returns.get(value);
		});
	});
	afterEach(() => {
		restore?.();
		restore = undefined;
	});
	return recorder;
}
