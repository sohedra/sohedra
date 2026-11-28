// mergeProps and mergePropsN: plain props, chained handlers and their prevention, callback props,
// class and style, attachments, and function sources.
import type { SohedraEvent } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { createAttachmentKey } from "svelte/attachments";
import { describe, expect, it, vi } from "vitest";

import { mergeProps, mergePropsN } from "#lib/foundation/kernel/index.js";

type Handler = (...args: unknown[]) => unknown;

/** Calls the merged prop `key` as a handler. */
function call(merged: Record<PropertyKey, unknown>, key: string, ...args: unknown[]) {
	return (merged[key] as Handler)(...args);
}

/** A class value as Svelte resolves it: nested arrays flattened, empty entries dropped. */
function resolveClass(value: unknown): string {
	return [value]
		.flat(Infinity)
		.filter((item) => typeof item === "string" && item !== "")
		.join(" ");
}

describe("mergeProps", () => {
	describe("plain props", () => {
		it("lets the rightmost plain prop win", () => {
			expect(mergeProps({ id: "a" }, { id: "b" }).id).toBe("b");
		});

		it("handles undefined sources and no sources", () => {
			expect(mergeProps()).toEqual({});
			expect(mergeProps(undefined, { id: "a" }, undefined)).toEqual({ id: "a" });
		});
	});

	describe("handlers", () => {
		it("runs handlers rightmost first", () => {
			const calls: string[] = [];
			const merged = mergeProps(
				{ onclick: () => calls.push("a") },
				{ onclick: () => calls.push("b") },
			);
			call(merged, "onclick", new Event("click"));
			expect(calls).toEqual(["b", "a"]);
		});

		it("merges multiple event handlers", () => {
			const log: string[] = [];
			const mergedProps = mergeProps(
				{ onclick: () => log.push("3") },
				{ onclick: () => log.push("2") },
				{ onclick: () => log.push("1") },
			);

			call(mergedProps, "onclick", new MouseEvent("click"));
			expect(log).toEqual(["1", "2", "3"]);
		});

		it("stops left handlers when the rightmost calls preventSohedraHandler", () => {
			const ours = vi.fn();
			const event = new Event("click", { cancelable: true });
			const merged = mergeProps(
				{ onclick: ours },
				{ onclick: (e: SohedraEvent<Event>) => e.preventSohedraHandler() },
			);
			call(merged, "onclick", event);
			expect(ours).not.toHaveBeenCalled();
			expect(event.defaultPrevented).toBe(false);
		});

		it("prevents handlers merged after event.preventSohedraHandler() is called", () => {
			const log: string[] = [];
			const mergedProps = mergeProps(
				{ onclick: () => log.push("2") },
				{
					onclick(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						log.push("1");
					},
				},
				{ onclick: () => log.push("0") },
			);

			call(mergedProps, "onclick", new MouseEvent("click"));
			expect(log).toEqual(["0", "1"]);
		});

		it("does not stop left handlers on preventDefault", () => {
			const ours = vi.fn();
			const merged = mergeProps({ onclick: ours }, { onclick: (e: Event) => e.preventDefault() });
			call(merged, "onclick", new Event("click", { cancelable: true }));
			expect(ours).toHaveBeenCalledOnce();
		});

		it("makes a lone synthetic event handler preventable", () => {
			let prevented = false;
			const mergedProps = mergeProps(
				{},
				{
					onmousedown(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						prevented = event.sohedraHandlerPrevented === true;
					},
				},
			);

			call(mergedProps, "onmousedown", new MouseEvent("mousedown"));
			expect(prevented).toBe(true);
		});

		it("makes a first-position synthetic event handler preventable", () => {
			let prevented = false;
			const mergedProps = mergeProps(
				{
					onmousedown(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						prevented = event.sohedraHandlerPrevented === true;
					},
				},
				{ id: "test-button" },
			);

			call(mergedProps, "onmousedown", new MouseEvent("mousedown"));
			expect(prevented).toBe(true);
		});

		it("makes a lone obscure synthetic event handler preventable", () => {
			let prevented = false;
			const mergedProps = mergeProps(
				{},
				{
					oncontextmenu(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						prevented = event.sohedraHandlerPrevented === true;
					},
				},
			);

			call(mergedProps, "oncontextmenu", new MouseEvent("contextmenu"));
			expect(prevented).toBe(true);
		});

		it("runs every handler for non-event arguments", () => {
			const calls: string[] = [];
			const merged = mergeProps(
				{ onchange: () => calls.push("a") },
				{ onchange: () => calls.push("b") },
			);
			call(merged, "onchange", "value");
			expect(calls).toEqual(["b", "a"]);
		});

		it("returns the rightmost handler's result", () => {
			const merged = mergeProps({ onclick: () => 1 }, { onclick: () => 2 });
			expect(call(merged, "onclick", new Event("click"))).toBe(2);
		});

		it("forwards additional arguments for synthetic event handlers", () => {
			const log: Array<[string, string]> = [];
			const mergedProps = mergeProps(
				{
					onmousedown(_event: SohedraEvent<MouseEvent>, details: { reason: string }) {
						log.push(["ours", details.reason]);
					},
				},
				{
					onmousedown(_event: SohedraEvent<MouseEvent>, details: { reason: string }) {
						log.push(["theirs", details.reason]);
					},
				},
			);

			call(mergedProps, "onmousedown", new MouseEvent("mousedown"), { reason: "pointer" });
			expect(log).toEqual([
				["theirs", "pointer"],
				["ours", "pointer"],
			]);
		});

		it("only treats on[a-z]+ function props as handlers", () => {
			const merged = mergeProps({ onClick: "a", ontest: 1 }, { onClick: "b", ontest: 2 });
			expect(merged.onClick).toBe("b");
			expect(merged.ontest).toBe(2);
		});

		it("keeps the defined side when a handler slot is undefined", () => {
			const fn = vi.fn();
			const event = new Event("click");
			const rightFn = mergeProps({ onclick: undefined }, { onclick: fn });
			call(rightFn, "onclick", event);
			expect(fn).toHaveBeenCalledOnce();

			const leftFn = mergeProps({ onclick: fn }, { onclick: undefined });
			call(leftFn, "onclick", event);
			expect(fn).toHaveBeenCalledTimes(2);

			const both = mergeProps({ onclick: undefined }, { onclick: undefined });
			expect("onclick" in both).toBe(true);
			expect(both.onclick).toBeUndefined();
		});
	});

	describe("callback props", () => {
		it("forwards all arguments for a lone non-standard event handler", () => {
			const handler = vi.fn();
			const mergedProps = mergeProps({}, { onOpenChange: handler });

			const eventDetails = { reason: "test" };
			call(mergedProps, "onOpenChange", true, eventDetails);
			expect(handler).toHaveBeenCalledWith(true, eventDetails);
		});

		// Differs on purpose: only lowercase `on[a-z]` handlers (Svelte's DOM event names) are
		// chained, so a camelCase callback is a plain prop and only the rightmost runs. The case
		// stays, skipped, as the record of the behaviour chaining it would have
		// (src/foundation/kernel/kernel-merged-props.ts, `isEventHandler`).
		// oxlint-disable-next-line vitest/no-disabled-tests -- the skipped case records a deliberate difference
		it.skip("forwards all arguments for merged non-standard event handlers", () => {
			const log: Array<[string, boolean, { reason: string }]> = [];
			const eventDetails = { reason: "test" };

			const mergedProps = mergeProps(
				{
					onOpenChange(open: boolean, details: { reason: string }) {
						log.push(["ours", open, details]);
					},
				},
				{
					onOpenChange(open: boolean, details: { reason: string }) {
						log.push(["theirs", open, details]);
					},
				},
			);

			call(mergedProps, "onOpenChange", true, eventDetails);
			expect(log).toEqual([
				["theirs", true, eventDetails],
				["ours", true, eventDetails],
			]);
		});
	});

	describe("class and style", () => {
		it("merges class as [theirs, ours] and drops undefined sides", () => {
			expect(mergeProps({ class: "a" }, { class: "b" }).class).toEqual(["b", "a"]);
			expect(mergeProps({ class: "a" }, { class: undefined }).class).toBe("a");
			expect(mergeProps({}, { class: "b" }).class).toBe("b");
		});

		it("merges multiple classNames", () => {
			const mergedProps = mergeProps(
				{ class: "class-1" },
				{ class: "class-2" },
				{ class: "class-3" },
			);
			expect(resolveClass(mergedProps.class)).toBe("class-3 class-2 class-1");
		});

		it("merges style so the rightmost declaration wins", () => {
			expect(mergeProps({ style: "color: red" }, { style: "color: blue" }).style).toBe(
				"color: red; color: blue",
			);
			expect(mergeProps({ style: "color: red;" }, { style: "top: 0" }).style).toBe(
				"color: red; top: 0",
			);
			expect(mergeProps({ style: "color: red" }, { style: undefined }).style).toBe("color: red");
		});

		it("merges styles with undefined", () => {
			const mergedProps = mergeProps({}, { style: "color: red" });
			expect(mergedProps.style).toBe("color: red");
		});
	});

	describe("attachments", () => {
		it("keeps attachments from every source", () => {
			const k1 = createAttachmentKey();
			const k2 = createAttachmentKey();
			const a = () => {};
			const b = () => {};
			const merged = mergeProps({ [k1]: a }, { [k2]: b });
			expect(merged[k1]).toBe(a);
			expect(merged[k2]).toBe(b);
		});
	});

	describe("function sources", () => {
		it("passes merged props to function sources and uses their result", () => {
			const first = vi.fn();
			const second = vi.fn();
			const received: unknown[] = [];
			const merged = mergeProps(
				{ id: "a", onclick: first },
				(props) => {
					received.push({ ...props });
					return { id: "fn" };
				},
				{ onclick: second },
			);
			expect(received).toHaveLength(1);
			expect((received[0] as { id: string }).id).toBe("a");
			expect(merged.id).toBe("fn");
			call(merged, "onclick", new Event("click"));
			expect(second).toHaveBeenCalledOnce();
			expect(first).not.toHaveBeenCalled();
		});

		it("calls the props getter with merged props defined after it", () => {
			let observedProps;
			const propsGetter = vi.fn((props: Record<PropertyKey, unknown>) => {
				observedProps = { ...props };
				return props;
			});

			mergeProps({ role: "button", class: "test-class" }, { role: "tab" }, propsGetter, {
				id: "one",
			});

			expect(propsGetter.mock.calls.length === 1).toBe(true);
			expect(observedProps).toEqual({ role: "tab", class: "test-class" });
		});

		it("calls the props getter with an empty object if no props are defined after it", () => {
			let observedProps;
			const propsGetter = vi.fn((props: Record<PropertyKey, unknown>) => {
				observedProps = { ...props };
				return props;
			});

			mergeProps(propsGetter, { id: "1" });

			expect(propsGetter.mock.calls.length === 1).toBe(true);
			expect(observedProps).toEqual({});
		});

		it("does not mutate a reused object returned by the first props getter", () => {
			const shared = { class: "base" };
			const result = mergeProps(() => shared, { class: "next" });

			expect({ ...result, class: resolveClass(result.class) }).toEqual({ class: "next base" });
			expect(shared).toEqual({ class: "base" });
		});

		it("does not automatically prevent handlers that are manually called by getter handlers", () => {
			const log: string[] = [];
			const mergedProps = mergeProps(
				{ onclick: () => log.push("first-handler") },
				(props) => ({
					onclick(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						log.push("getter-handler");
						// Calling the earlier handler itself bypasses the prevention.
						call(props, "onclick", new MouseEvent("click"));
					},
				}),
				// Does not prevent, so the getter's handler runs.
				{ onclick: () => log.push("last-handler") },
			);

			call(mergedProps, "onclick", new MouseEvent("click"));

			// The last handler, then the getter's, which calls the first despite its prevention.
			expect(log).toEqual(["last-handler", "getter-handler", "first-handler"]);
		});

		it("allows props getter handlers to check sohedraHandlerPrevented manually", () => {
			const log: string[] = [];
			const mergedProps = mergeProps(
				{ onclick: () => log.push("first-handler") },
				(props) => ({
					onclick(event: SohedraEvent<MouseEvent>) {
						event.preventSohedraHandler();
						log.push("getter-handler");
						// Checking the flag first respects the prevention.
						if (!event.sohedraHandlerPrevented) {
							call(props, "onclick", new MouseEvent("click"));
						}
					},
				}),
				{ onclick: () => log.push("last-handler") },
			);

			call(mergedProps, "onclick", new MouseEvent("click"));

			// The first handler does not run: the getter's handler checked the flag.
			expect(log).toEqual(["last-handler", "getter-handler"]);
		});
	});
});

describe("mergePropsN", () => {
	it("makes a first-position synthetic event handler preventable, as mergeProps does", () => {
		let prevented = false;
		const mergedProps = mergePropsN([
			{
				onmousedown(event: SohedraEvent<MouseEvent>) {
					event.preventSohedraHandler();
					prevented = event.sohedraHandlerPrevented === true;
				},
			},
			{ id: "test-button" },
		]);

		call(mergedProps, "onmousedown", new MouseEvent("mousedown"));
		expect(prevented).toBe(true);
	});
});
