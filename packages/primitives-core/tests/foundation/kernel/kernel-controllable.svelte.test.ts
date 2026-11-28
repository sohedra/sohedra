// Controllable: where its value comes from (the binding, the local value, the default), a change
// with its callback and refusals, a reset, an assignment, object and array values, and the
// development warning.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import {
	bound,
	Controllable,
	createChangeEventDetails,
	REASONS,
} from "../../../src/foundation/kernel/index.js";
import { root, track } from "../../kit/kit-effects.svelte.js";

const details = () => createChangeEventDetails(REASONS.none, { type: "click" } as unknown as Event);

/**
 * A `$bindable` as a parent binds it: `bind:value={parent.value}` to a `$state`, which proxies an
 * object assigned to it, or, with `declines`, a function binding whose getter returns the parent's
 * value as given and whose setter keeps it. The setter is a spy; the test sets `parent.value`.
 */
function binding<T>(initial: T | undefined, { declines = false } = {}) {
	let proxied = $state(initial);
	let given = $state.raw(initial);
	const parent = {
		get value() {
			return declines ? given : proxied;
		},
		set value(next) {
			if (declines) {
				given = next;
			} else {
				proxied = next;
			}
		},
	};
	const set = vi.fn((next: T | undefined) => {
		if (!declines) {
			parent.value = next;
		}
	});
	return { parent, set, source: bound(() => parent.value, set) };
}

/** A Controllable on `binding(initial)`, with `fallback` as its default. */
function setup<T>(
	initial: T | undefined,
	fallback: T,
	options: { declines?: boolean; writeInitial?: boolean } = {},
) {
	const { parent, set, source } = binding<T>(initial, options);
	const value = new Controllable<T>(source, {
		default: () => fallback,
		name: "Test",
		state: "value",
		writeInitial: options.writeInitial,
	});
	return { value, parent, set };
}

type Option = { id: string };
const A: Option = { id: "a" };
const B: Option = { id: "b" };

describe("Controllable", () => {
	it("starts from the source when it is defined, without writing it", () => {
		const { value, set } = setup<boolean>(true, false);
		expect(value.current).toBe(true);
		expect(set).not.toHaveBeenCalled();
	});

	it("writes the default to an undefined source, like a native bind:checked", () => {
		const { value, parent } = setup<boolean>(undefined, true);
		expect(parent.value).toBe(true);
		expect(value.current).toBe(true);
	});

	it("does not write an undefined initial value to the binding", () => {
		const { value, set } = setup<string | undefined>(undefined, undefined, { declines: true });
		expect(set).not.toHaveBeenCalled();
		expect(value.current).toBeUndefined();
	});

	it("leaves an unset binding alone with writeInitial: false", () => {
		const { value, parent } = setup<string>(undefined, "", { writeInitial: false });
		expect(parent.value).toBeUndefined();
		expect(value.current).toBe("");
	});

	it("does not track the source or default while constructing", () => {
		const { parent, source } = binding<boolean>(undefined);
		const { runs } = track(
			() => void new Controllable(source, { default: () => true, name: "Test", state: "value" }),
		);
		parent.value = false;
		flushSync();
		expect(runs.length).toBe(1);
	});

	it("keeps the last accepted value locally once the parent passes undefined", () => {
		const { value, parent } = setup<boolean>(false, false);
		expect(value.set(true, details())).toBe(true);
		parent.value = undefined;
		expect(value.current).toBe(true);
		parent.value = false;
		expect(value.current).toBe(false);
	});

	describe("set", () => {
		it("calls onChange before writing, and writes through to the source", () => {
			const { value, parent } = setup<boolean>(false, false);
			const calls: string[] = [];
			const committed = value.set(true, details(), (next) => {
				calls.push(`onChange(${next}) while source=${parent.value}`);
			});
			expect(committed).toBe(true);
			expect(calls).toEqual(["onChange(true) while source=false"]);
			expect(parent.value).toBe(true);
			expect(value.current).toBe(true);
		});

		it("skips the write when onChange cancels", () => {
			const { value, parent } = setup<boolean>(false, false);
			const committed = value.set(true, details(), (_next, d) => d.cancel());
			expect(committed).toBe(false);
			expect(parent.value).toBe(false);
			expect(value.current).toBe(false);
		});

		it("reports a function binding that declines the write", () => {
			const { value, set } = setup<boolean>(false, false, { declines: true });
			expect(value.set(true, details())).toBe(false);
			expect(set).toHaveBeenCalledWith(true);
			expect(value.current).toBe(false);
		});

		it("does not keep a declined value locally", () => {
			const { value, parent } = setup<boolean>(false, false, { declines: true });
			expect(value.set(true, details())).toBe(false);
			parent.value = undefined;
			expect(value.current).toBe(false);
		});

		describe("when the change callback sets the source", () => {
			it("keeps the value the callback stored instead of overwriting it", () => {
				const { value, parent } = setup<string>("", "");
				const write = vi.fn();
				const accepted = value.set("ab", details(), (next) => {
					write(next);
					parent.value = next.toUpperCase();
				});

				expect(write).toHaveBeenCalledWith("ab");
				expect(value.current).toBe("AB");
				expect(parent.value).toBe("AB");
				// The proposed value didn't land, so the caller reverts its native side effects.
				expect(accepted).toBe(false);
			});

			it("reports acceptance when the callback stored the proposed value", () => {
				const { value, parent } = setup<boolean>(false, false);
				const accepted = value.set(true, details(), (next) => {
					parent.value = next;
				});

				expect(accepted).toBe(true);
				expect(value.current).toBe(true);
			});
		});
	});

	describe("reset", () => {
		it("resets to the default without calling onChange", () => {
			const { value, parent } = setup<boolean>(true, false);
			expect(value.reset()).toBe(true);
			expect(parent.value).toBe(false);
			expect(value.current).toBe(false);
		});

		it("reports a declined reset", () => {
			const { value } = setup<boolean>(true, false, { declines: true });
			expect(value.reset()).toBe(false);
			expect(value.current).toBe(true);
		});

		it("keeps a declined reset out of the local value", () => {
			const { value, parent } = setup<boolean>(true, false, { declines: true });
			expect(value.reset()).toBe(false);
			parent.value = undefined;
			expect(value.current).toBe(true);
		});
	});

	describe("assign", () => {
		it("writes through to the source without a change callback", () => {
			const { value, parent } = setup<string>(undefined, "");
			expect(value.assign("typed")).toBe(true);
			expect(parent.value).toBe("typed");
			expect(value.current).toBe("typed");
			// The local value holds it too, should the parent stop controlling.
			parent.value = undefined;
			expect(value.current).toBe("typed");
		});

		it("reports a declined write and keeps it out of the local value", () => {
			const { value, parent } = setup<string>("bound", "", { declines: true });
			expect(value.assign("typed")).toBe(false);
			expect(value.current).toBe("bound");
			// The local value is still the initial one, not the declined value.
			parent.value = undefined;
			expect(value.current).toBe("bound");
		});
	});

	// Controllable keeps the very object it was given (never a deep proxy), and an object written
	// through a parent's `$state`, which proxies it, still reads as the object.
	describe("with object values", () => {
		it("keeps an uncontrolled object as given", () => {
			// No binding: the source stays unset, so the value is the store's own.
			const unset = bound<Option | undefined>(
				() => undefined,
				() => {},
			);
			const value = new Controllable<Option | undefined>(unset, {
				default: () => A,
				name: "Test",
				state: "value",
			});
			expect(value.current).toBe(A);
			expect(value.set(B, details())).toBe(true);
			expect(value.current).toBe(B);
		});

		it("reads an object written through a proxying binding as the object", () => {
			const { value, parent } = setup<Option | undefined>(undefined, A);
			expect(parent.value).not.toBe(A);
			expect(value.current).toBe(A);

			expect(value.set(B, details())).toBe(true);
			expect(parent.value).not.toBe(B);
			expect(parent.value).toEqual(B);
			expect(value.current).toBe(B);
		});

		it("follows the binding once the parent sets another value", () => {
			const { value, parent } = setup<Option | undefined>(undefined, A);
			parent.value = { id: "c" };
			expect(value.current).toEqual({ id: "c" });
			expect(value.current).not.toBe(A);
		});

		it("still sees a declining binding keep its value", () => {
			const { value } = setup<Option>(A, A, { declines: true });
			expect(value.set(B, details())).toBe(false);
			expect(value.current).toBe(A);
		});
	});

	describe("with an array written through a proxying binding", () => {
		it("reads the written array, its object items as written", () => {
			const { value, parent } = setup<unknown[]>(undefined, []);
			const written = [A, "b"];
			expect(value.set(written, details())).toBe(true);
			expect(parent.value).not.toBe(written);
			expect(value.current).toBe(written);
			expect(value.current[0]).toBe(A);
		});

		it("sees the proxy mutated in place, keeping written object items as written", () => {
			const { value, parent } = setup<unknown[]>(undefined, []);
			const { runs } = track(() => value.current);
			const current = () => runs.at(-1)!;

			value.set([A], details());
			flushSync();
			parent.value!.push("b");
			flushSync();
			expect(current()).toEqual([A, "b"]);
			expect(current()[0]).toBe(A);

			// A write built from what it read keeps the pushed item.
			expect(value.set([...current(), B], details())).toBe(true);
			flushSync();
			expect(current()).toEqual([A, "b", B]);
		});

		it("writes its default to an unset binding as a mutable array", () => {
			const { value, parent } = setup<unknown[]>(undefined, []);
			expect(() => parent.value!.push("b")).not.toThrow();
			expect(value.current).toEqual(["b"]);
		});
	});

	describe("connect", () => {
		it("warns once when the default of an initially uncontrolled value changes", () => {
			const error = vi.spyOn(console, "error").mockImplementation(() => {});
			let fallback = $state(false);
			const { source } = binding<boolean>(undefined);
			root(() => {
				const value = new Controllable(source, {
					default: () => fallback,
					name: "Switch",
					state: "checked",
				});
				value.connect();
			});
			flushSync();
			expect(error).not.toHaveBeenCalled();
			fallback = true;
			flushSync();
			expect(error).toHaveBeenCalledTimes(1);
			expect(error.mock.calls[0][0]).toMatch(
				/^Sohedra: A component is changing the default checked state of an uncontrolled Switch/,
			);
			error.mockRestore();
		});
	});
});
