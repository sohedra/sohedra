import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Controllable, type ControllableSource } from "../../../src/foundation/kernel/index.js";

type Details = { isCanceled: boolean; cancel(): void };

function details(): Details {
	return {
		isCanceled: false,
		cancel() {
			this.isCanceled = true;
		},
	};
}

/** A bound `$bindable`: writes reach the parent's state. */
function boundSource<T>(initial: T | undefined) {
	let value = $state(initial);
	return {
		get value() {
			return value;
		},
		set value(next) {
			value = next;
		},
	} satisfies ControllableSource<T>;
}

/** A function binding whose setter records writes but whose getter keeps returning `fixed`. */
function decliningSource<T>(fixed: T) {
	const set = vi.fn();
	const source: ControllableSource<T> = {
		get value() {
			return fixed;
		},
		set value(next) {
			set(next);
		},
	};
	return { source, set };
}

const options = (fallback: boolean) => ({ default: () => fallback, name: "Test", state: "value" });

const roots: (() => void)[] = [];
afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

describe("Controllable", () => {
	it("starts from the source when it is defined, without writing it", () => {
		const source = boundSource<boolean>(true);
		const spy = vi.spyOn(source, "value", "set");
		const value = new Controllable(source, options(false));
		expect(value.current).toBe(true);
		expect(spy).not.toHaveBeenCalled();
	});

	it("writes the default to an undefined source, like a native bind:checked", () => {
		const source = boundSource<boolean>(undefined);
		const value = new Controllable(source, options(true));
		expect(source.value).toBe(true);
		expect(value.current).toBe(true);
	});

	it("calls onChange before writing, and writes through to the source", () => {
		const source = boundSource<boolean>(false);
		const value = new Controllable(source, options(false));
		const calls: string[] = [];
		const committed = value.set(true, details(), (next) => {
			calls.push(`onChange(${next}) while source=${source.value}`);
		});
		expect(committed).toBe(true);
		expect(calls).toEqual(["onChange(true) while source=false"]);
		expect(source.value).toBe(true);
		expect(value.current).toBe(true);
	});

	it("skips the write when onChange cancels", () => {
		const source = boundSource<boolean>(false);
		const value = new Controllable(source, options(false));
		const committed = value.set(true, details(), (_next, d) => d.cancel());
		expect(committed).toBe(false);
		expect(source.value).toBe(false);
		expect(value.current).toBe(false);
	});

	it("reports a function binding that declines the write", () => {
		const { source, set } = decliningSource(false);
		const value = new Controllable(source, options(false));
		expect(value.set(true, details())).toBe(false);
		expect(set).toHaveBeenCalledWith(true);
		expect(value.current).toBe(false);
	});

	it("does not keep a declined value locally", () => {
		let parent = $state<boolean | undefined>(false);
		const source: ControllableSource<boolean> = {
			get value() {
				return parent;
			},
			set value(_next) {
				// A function binding that declines every write.
			},
		};
		const value = new Controllable(source, options(false));
		expect(value.set(true, details())).toBe(false);
		parent = undefined;
		expect(value.current).toBe(false);
	});

	it("keeps a declined reset out of the local value", () => {
		let parent = $state<boolean | undefined>(true);
		const source: ControllableSource<boolean> = {
			get value() {
				return parent;
			},
			set value(_next) {},
		};
		const value = new Controllable(source, options(false));
		expect(value.reset()).toBe(false);
		parent = undefined;
		expect(value.current).toBe(true);
	});

	it("does not write an undefined initial value to the binding", () => {
		const { source, set } = decliningSource<string | undefined>(undefined);
		const value = new Controllable<string | undefined>(source, {
			default: () => undefined,
			name: "Field",
			state: "value",
		});
		expect(set).not.toHaveBeenCalled();
		expect(value.current).toBeUndefined();
	});

	it("leaves an unset binding alone with writeInitial: false", () => {
		const source = boundSource<string>(undefined);
		const value = new Controllable(source, {
			default: () => "",
			name: "Field",
			state: "value",
			writeInitial: false,
		});
		expect(source.value).toBeUndefined();
		expect(value.current).toBe("");
	});

	it("keeps the last accepted value locally once the parent passes undefined", () => {
		const source = boundSource<boolean>(false);
		const value = new Controllable(source, options(false));
		expect(value.set(true, details())).toBe(true);
		source.value = undefined;
		expect(value.current).toBe(true);
		source.value = false;
		expect(value.current).toBe(false);
	});

	it("resets to the default without calling onChange", () => {
		const source = boundSource<boolean>(true);
		const value = new Controllable(source, options(false));
		expect(value.reset()).toBe(true);
		expect(source.value).toBe(false);
		expect(value.current).toBe(false);
	});

	it("reports a declined reset", () => {
		const { source } = decliningSource(true);
		const value = new Controllable(source, options(false));
		expect(value.reset()).toBe(false);
		expect(value.current).toBe(true);
	});

	it("does not track the source or default while constructing", () => {
		const source = boundSource<boolean>(undefined);
		let runs = 0;
		roots.push(
			$effect.root(() => {
				$effect(() => {
					runs += 1;
					new Controllable(source, options(true));
				});
			}),
		);
		flushSync();
		source.value = false;
		flushSync();
		expect(runs).toBe(1);
	});

	it("warns once when the default of an initially uncontrolled value changes", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		let fallback = $state(false);
		const source = boundSource<boolean>(undefined);
		roots.push(
			$effect.root(() => {
				const value = new Controllable(source, {
					default: () => fallback,
					name: "Switch",
					state: "checked",
				});
				value.connect();
			}),
		);
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

describe("Controllable: a change callback that sets the source", () => {
	it("keeps the value the callback stored instead of overwriting it", () => {
		const source = boundSource<string>("");
		const controllable = new Controllable(source, { default: () => "", name: "X", state: "v" });
		const write = vi.fn();
		const accepted = controllable.set("ab", details(), (next) => {
			write(next);
			source.value = next.toUpperCase();
		});

		expect(write).toHaveBeenCalledWith("ab");
		expect(controllable.current).toBe("AB");
		expect(source.value).toBe("AB");
		// The proposed value didn't land, so the caller reverts its native side effects.
		expect(accepted).toBe(false);
	});

	it("reports acceptance when the callback stored the proposed value", () => {
		const source = boundSource<boolean>(false);
		const controllable = new Controllable(source, {
			default: () => false,
			name: "X",
			state: "v",
		});
		const accepted = controllable.set(true, details(), (next) => {
			source.value = next;
		});

		expect(accepted).toBe(true);
		expect(controllable.current).toBe(true);
	});
});
