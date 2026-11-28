// `describeConformance`: the contract every part keeps in the browser (its element, extra props,
// handlers, class and style, state attributes, `bind:ref`, attachments, the render and children
// snippets, and server rendering with hydration).
import type { SohedraEvent } from "@sohedra/primitives-core/foundation/kernel";
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";

import { expectNoAxeViolations } from "../kit/kit-axe.js";
import { renderPartOnServer, ssrHydration } from "../kit/kit-server.js";
import {
	harnessProps,
	serverRenderProps,
	type ConformanceSetup,
	type HarnessOptions,
} from "./conformance-setup.js";
import ConformanceHarness from "./fixtures/conformance-harness.svelte";

const RENDER_WITHOUT_SPREAD_WARNING =
	"Sohedra: The render snippet must spread `props` onto an element.";

/**
 * The conformance suite every part runs in the browser. Its hydration case has the server render
 * the part when it runs, from the modules the setup's `server` names.
 */
export function describeConformance<State>(name: string, setup: () => ConformanceSetup<State>) {
	// A part with empty state (Form) has no state to toggle: its state checks are skipped.
	const stateless = !setup().state;
	// The state props and checks of a stateful part (only read in `whenStateful` tests).
	const stateOf = () => setup().state!;
	// Tests that apply only with or without state are left out, not reported as skipped.
	const whenStateful = stateless ? omit : it;
	const whenStateless = stateless ? it : omit;

	describe(`${name} conformance`, () => {
		async function renderPart(options: HarnessOptions = {}) {
			const base = setup();
			const result = await render(ConformanceHarness, {
				props: harnessProps(base, options),
			});
			return {
				...result,
				part: result.getByTestId("part"),
				getRef: () => result.component.getRef(),
				update: (next: HarnessOptions) => result.rerender(harnessProps(base, next)),
			};
		}

		it("renders its default element", async () => {
			const { part } = await renderPart();
			await expect.element(part).toBeInTheDocument();
			expect(part.element().tagName.toLowerCase()).toBe(setup().defaultTag);
		});

		it("has no axe violations in its default rendered state", async () => {
			const { axe } = setup();
			const { part } = await renderPart({ withChildren: true, partProps: axe?.props });
			await expect.element(part).toBeInTheDocument();
			await expectNoAxeViolations(document.body, axe);
		});

		it("forwards extra props", async () => {
			const { getByTestId } = await renderPart({
				// Not `id`: some parts put it elsewhere (Switch.Root puts it on its hidden input).
				partProps: { "data-testid": "forwarded", "aria-label": "Label", lang: "fr" },
			});
			const part = getByTestId("forwarded");
			if (setup().ariaOnInput) {
				// The part gives its ARIA props to the range input it renders (Slider.Thumb).
				const input = part.element().querySelector('input[type="range"]');
				expect(input).toHaveAttribute("aria-label", "Label");
				expect(part.element()).not.toHaveAttribute("aria-label");
			} else {
				await expect.element(part).toHaveAttribute("aria-label", "Label");
			}
			await expect.element(part).toHaveAttribute("lang", "fr");
		});

		it("merges user handlers before its own and honours preventSohedraHandler", async () => {
			const { readOwnClick } = setup();
			const calls: string[] = [];
			let prevent = true;
			const onclick = (event: SohedraEvent<MouseEvent>) => {
				calls.push("user");
				if (prevent) {
					event.preventSohedraHandler();
				}
			};
			// Children give the element a size, so it can be clicked.
			const { part } = await renderPart({ withChildren: true, partProps: { onclick } });
			await expect.element(part).toBeInTheDocument();
			const initial = readOwnClick?.(part.element());

			await userEvent.click(part);
			flushSync();
			expect(calls).toEqual(["user"]);
			if (readOwnClick) {
				expect(readOwnClick(part.element())).toEqual(initial);
			}

			prevent = false;
			await userEvent.click(part);
			flushSync();
			expect(calls).toEqual(["user", "user"]);
			if (readOwnClick) {
				expect(readOwnClick(part.element())).not.toEqual(initial);
			}
		});

		whenStateless("accepts class as a value or a function of its state", async () => {
			const { part, update } = await renderPart({ partProps: { class: "a" } });
			await expect.element(part).toHaveClass("a");

			await update({ partProps: { class: (s: State) => (s ? "fn" : "none") } });
			await expect.element(part).toHaveClass("fn");
		});

		whenStateless("accepts style as a value or a function of its state", async () => {
			const { part, update } = await renderPart({
				partProps: { style: "color: rgb(255, 0, 0)" },
			});
			await expect.element(part).toHaveStyle({ color: "rgb(255, 0, 0)" });

			await update({
				partProps: {
					style: (s: State) => (s ? "color: rgb(0, 128, 0)" : "color: rgb(0, 0, 255)"),
				},
			});
			await expect.element(part).toHaveStyle({ color: "rgb(0, 128, 0)" });
		});

		whenStateful("accepts class as a value or a function of state", async () => {
			const state = stateOf();
			const byState = (s: State) => (state.isOn(s) ? "on" : "off");
			const { part, update } = await renderPart({ partProps: { class: "a" } });
			await expect.element(part).toHaveClass("a");

			await update({ partProps: { ...state.on, class: byState } });
			await expect.element(part).toHaveClass("on");

			await update({ partProps: { ...state.off, class: byState } });
			await expect.element(part).toHaveClass("off");
			await expect.element(part).not.toHaveClass("on");
		});

		whenStateful("accepts style as a value or a function of state", async () => {
			const state = stateOf();
			const byState = (s: State) =>
				state.isOn(s) ? "color: rgb(0, 128, 0)" : "color: rgb(0, 0, 255)";
			const { part, update } = await renderPart({
				partProps: { style: "color: rgb(255, 0, 0)" },
			});
			await expect.element(part).toHaveStyle({ color: "rgb(255, 0, 0)" });

			await update({ partProps: { ...state.on, style: byState } });
			await expect.element(part).toHaveStyle({ color: "rgb(0, 128, 0)" });

			await update({ partProps: { ...state.off, style: byState } });
			await expect.element(part).toHaveStyle({ color: "rgb(0, 0, 255)" });
		});

		whenStateful("renders state as data attributes", async () => {
			const state = stateOf();
			const { part, update } = await renderPart({ partProps: state.on });
			await expect.element(part).toHaveAttribute(state.attribute);

			await update({ partProps: state.off });
			await expect.element(part).not.toHaveAttribute(state.attribute);
		});

		it("exposes the element through bind:ref", async () => {
			const { part, getRef } = await renderPart();
			await expect.element(part).toBeInTheDocument();
			expect(getRef()).toBe(part.element());
		});

		it("passes attachments on the part through to the element", async () => {
			const attach = vi.fn();
			const { part } = await renderPart({ attach });
			await expect.element(part).toBeInTheDocument();
			expect(attach).toHaveBeenCalledWith(part.element());
		});

		whenStateful("passes state to the render snippet", async () => {
			const state = stateOf();
			const { part, update } = await renderPart({ render: "button", partProps: state.on });
			await expect.element(part).toHaveAttribute("data-on", "true");

			await update({ render: "button", partProps: state.off });
			await expect.element(part).toHaveAttribute("data-on", "false");
		});

		it("replaces the element with the render snippet", async () => {
			const { state } = setup();
			const { part, getRef } = await renderPart({ render: "button", partProps: state?.on });
			await expect.element(part).toBeInTheDocument();
			expect(part.element().tagName).toBe("BUTTON");
			if (state) {
				await expect.element(part).toHaveAttribute(state.attribute);
			}
			expect(getRef()).toBe(part.element());
		});

		(stateless ? omit : it.skipIf(setup().childless))(
			"passes state to the children snippet",
			async () => {
				const state = stateOf();
				const { part, getByTestId, update } = await renderPart({
					withChildren: true,
					partProps: state.on,
				});
				const children = getByTestId("children");
				await expect.element(children).toHaveTextContent("on");
				expect(part.element().contains(children.element())).toBe(true);

				await update({ withChildren: true, partProps: state.off });
				await expect.element(children).toHaveTextContent("off");
			},
		);

		(stateless ? omit : it.skipIf(setup().childless))(
			"passes its content to the render snippet",
			async () => {
				const state = stateOf();
				const warn = vi.spyOn(console, "warn");
				try {
					const { part, getByTestId, update } = await renderPart({
						render: "button",
						withChildren: true,
						partProps: state.on,
					});
					const children = getByTestId("children");
					await expect.element(children).toHaveTextContent("on");
					expect(part.element().tagName).toBe("BUTTON");
					expect(part.element().contains(children.element())).toBe(true);

					await update({ render: "button", withChildren: true, partProps: state.off });
					await expect.element(children).toHaveTextContent("off");
					expect(warn).not.toHaveBeenCalled();
				} finally {
					warn.mockRestore();
				}
			},
		);

		it("survives server rendering and hydration", async () => {
			const html = await renderPartOnServer(setup());
			const { state, clientOnly } = setup();
			if (clientOnly) {
				// The part renders only after mount, possibly outside the container (a Portal moves it).
				let hydrated: { tag: string; attributes: Record<string, string> } | null = null;
				const { before, after } = ssrHydration(
					ConformanceHarness,
					serverRenderProps(setup()),
					html,
					(container) => {
						const part = container.ownerDocument.querySelector('[data-testid="part"]');
						hydrated = part && {
							tag: part.tagName.toLowerCase(),
							attributes: Object.fromEntries(
								Array.from(part.attributes, (attribute) => [attribute.name, attribute.value]),
							),
						};
					},
				);
				expect(before).not.toContainEqual(
					expect.objectContaining({ data: expect.objectContaining({ "data-testid": "part" }) }),
				);
				expect(hydrated).toEqual({
					tag: setup().defaultTag,
					attributes: expect.objectContaining(
						state ? { [state.attribute]: expect.any(String) } : {},
					),
				});
				// What the server did render is kept by hydration.
				expect(after).toEqual(expect.arrayContaining(before));
				return;
			}
			const { before, after } = ssrHydration(ConformanceHarness, serverRenderProps(setup()), html);
			expect(before).toContainEqual(
				expect.objectContaining({ data: expect.objectContaining({ "data-testid": "part" }) }),
			);
			if (state) {
				expect(before).toContainEqual(
					expect.objectContaining({
						data: expect.objectContaining({ [state.attribute]: expect.any(String) }),
					}),
				);
			}
			const settled = setup().settledOnMount ?? {};
			const idsAssignedOnMount = setup().idsAssignedOnMount ?? false;
			// Each settled attribute goes from its server value to its client value; the rest stays.
			const settle = (snapshots: typeof before, side: "server" | "client") =>
				snapshots.map((snapshot, index) => {
					const data = { ...snapshot.data };
					for (const [key, values] of Object.entries(settled)) {
						if (key in data) {
							expect(data[key], `${key} (${side})`).toBe(values[side]);
							delete data[key];
						}
					}
					// An id the client assigns on mount: none on the server, one after hydration.
					if (idsAssignedOnMount && before[index]?.id === "" && after[index]?.id !== "") {
						return { ...snapshot, id: "", data };
					}
					return { ...snapshot, data };
				});
			expect(settle(after, "client")).toEqual(settle(before, "server"));
		});

		it("does not throw when the render snippet ignores props, and warns in development", async () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const { getByText, getRef } = await renderPart({ render: "ignore-props" });
				await expect.element(getByText("ignored props")).toBeInTheDocument();
				expect(getRef()).toBeNull();
				await expect
					.poll(() => warn.mock.calls.filter((args) => args[0] === RENDER_WITHOUT_SPREAD_WARNING))
					.toHaveLength(1);
			} finally {
				warn.mockRestore();
			}
		});

		whenStateful("keeps state and moves the ref when render is toggled", async () => {
			const { readOwnClick, defaultTag } = setup();
			const state = stateOf();
			// A size, so the element can be clicked without children (which the render snippet ignores).
			const style = "display: inline-block; width: 16px; height: 16px";
			const { part, getRef, component } = await renderPart({
				partProps: { ...(readOwnClick ? state.off : state.on), style },
			});
			if (readOwnClick) {
				// Turn the state on through the part itself, so only the part holds it.
				await expect.element(part).not.toHaveAttribute(state.attribute);
				await userEvent.click(part);
			}
			await expect.element(part).toHaveAttribute(state.attribute);
			expect(getRef()).toBe(part.element());

			component.setRender("button");
			flushSync();
			await expect.element(part).toHaveAttribute(state.attribute);
			expect(part.element().tagName).toBe("BUTTON");
			expect(getRef()).toBe(part.element());

			component.setRender(undefined);
			flushSync();
			await expect.element(part).toHaveAttribute(state.attribute);
			expect(part.element().tagName.toLowerCase()).toBe(defaultTag);
			expect(getRef()).toBe(part.element());
		});
	});
}

function omit(_name: string, _test: () => unknown): void {}
