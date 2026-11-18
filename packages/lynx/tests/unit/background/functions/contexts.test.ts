// The contexts of main-thread functions on the background: given to a copy of each function that
// reaches a background function, where it is sent, and kept until the main thread lets go of it.

import { describe, expect, it } from "@rstest/core";

import { transformToWorklet } from "../../../../src/background/functions/calls.ts";
import { createContexts } from "../../../../src/background/functions/contexts.ts";

describe("a function's context", () => {
	it("is given to a copy of a function that calls the background, and to none that does not", () => {
		const contexts = createContexts();
		const save = () => "saved";
		const calls = { _wkltId: "f", _jsFn: { _jsFn1: transformToWorklet(save) } };
		const pure = { _wkltId: "g", _c: { n: 1 } };
		const given: number[] = [];
		const sent = contexts.send({ tap: calls, scroll: pure, list: [calls] }, given) as Record<
			string,
			unknown
		>;
		expect(given).toHaveLength(2);
		expect(sent["scroll"]).toBe(pure);
		expect(sent["tap"]).not.toBe(calls);
		expect(sent["tap"]).toMatchObject({ _wkltId: "f", _execId: given[0] });
		expect((sent["list"] as unknown[])[0]).toMatchObject({ _execId: given[1] });
		// The function as the app holds it is left as it was.
		expect(calls).not.toHaveProperty("_execId");
		expect(contexts.find(given[0]!, calls._jsFn._jsFn1._jsFnId!)?.()).toBe("saved");
	});

	it("is given to a function that reaches the background through one it captured, and found there", () => {
		const contexts = createContexts();
		const inner = { _wkltId: "inner", _jsFn: { _jsFn1: transformToWorklet(() => 2) } };
		const outer = { _wkltId: "outer", _c: { inner } };
		const given: number[] = [];
		contexts.send(outer, given);
		expect(contexts.find(given[0]!, inner._jsFn._jsFn1._jsFnId!)?.()).toBe(2);
	});

	it("reads a class instance as it is sent, through its toJSON", () => {
		const contexts = createContexts();
		const callback = { _wkltId: "cb", _jsFn: { _jsFn1: transformToWorklet(() => {}) } };
		class Gesture {
			toJSON() {
				return { callbacks: { onUpdate: callback } };
			}
		}
		const given: number[] = [];
		const sent = contexts.send(new Gesture(), given) as { callbacks: { onUpdate: unknown } };
		expect(given).toHaveLength(1);
		expect(sent.callbacks.onUpdate).toMatchObject({ _execId: given[0] });
	});

	it("is kept until released, and never given twice", () => {
		const contexts = createContexts();
		const fn = { _wkltId: "f", _jsFn: { _jsFn1: transformToWorklet(() => {}) } };
		const given: number[] = [];
		contexts.send(fn, given);
		contexts.send(fn, given);
		contexts.send(fn, given);
		expect(new Set(given).size).toBe(3);
		contexts.release([given[0]!]);
		contexts.keepOnly(new Set([given[2]!]));
		expect(contexts.ids()).toEqual([given[2]]);
		expect(contexts.find(given[0]!, fn._jsFn._jsFn1._jsFnId!)).toBeUndefined();
		contexts.clear();
		expect(contexts.ids()).toEqual([]);
	});
});
