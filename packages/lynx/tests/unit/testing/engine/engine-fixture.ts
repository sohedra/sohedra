// What the engine's tests share: an engine for each test, taken down after it, and a small page.

import { afterEach, beforeEach } from "@rstest/core";

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
