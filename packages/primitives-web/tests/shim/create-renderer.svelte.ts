import userEvent from "@testing-library/user-event";
// The test helpers (`createRenderer`, `render`, `setProps`, `user`, `clock`) on Vitest browser
// mode. A JSX tree becomes a fixture component.
import { flushSync, mount, unmount, type Component } from "svelte";
import { afterEach, beforeEach, vi } from "vitest";

type UserEvent = ReturnType<typeof userEvent.setup>;

/**
 * Applies Svelte's pending updates after a microtask, as `tick()` does without
 * `experimental.async`. With it, `tick()` waits for a frame or a timeout instead, which never come
 * while fake timers are installed, so the helpers wait with this in both modes.
 */
export async function flushAfterMicrotask(): Promise<void> {
	await Promise.resolve();
	flushSync();
}

export interface RenderResult<Exports> {
	/** The element the component is mounted into. */
	container: HTMLElement;
	/** The component's exports (`export function …` in its script). */
	component: Exports;
	/** Testing Library's `user-event`, flushing Svelte after every action. */
	user: UserEvent;
	/** Merges new props into the rendered ones and flushes (`setProps`). */
	setProps(props: Record<string, unknown>): Promise<void>;
	unmount(): void;
}

export interface Clock {
	/** Installs fake timers before each test of the enclosing `describe`, and restores after. */
	withFakeTimers(): void;
	/** Advances fake time by `ms` and flushes. */
	tick(ms: number): void;
	/** Runs the timers pending now (not ones they schedule) and flushes. */
	runToLast(): void;
	/** Runs every timer, including ones scheduled meanwhile, and flushes. */
	runAll(): void;
	restore(): void;
}

/** `createRenderer`: a `render` that cleans up after each test, and a fake `clock`. */
export function createRenderer() {
	const cleanups = new Set<() => void>();

	afterEach(() => {
		for (const cleanup of cleanups) {
			cleanup();
		}
		cleanups.clear();
	});

	async function render<Props extends object, Exports extends Record<string, unknown>>(
		Component: Component<Props, Exports>,
		props?: Partial<Props>,
	): Promise<RenderResult<Exports>> {
		const container = document.body.appendChild(document.createElement("div"));
		const state = $state({ ...props }) as Props;
		let component: Exports;
		try {
			component = mount(Component, { target: container, props: state });
		} catch (error) {
			container.remove();
			throw error;
		}
		const remove = () => {
			cleanups.delete(remove);
			void unmount(component);
			container.remove();
		};
		cleanups.add(remove);
		flushSync();
		await flushAfterMicrotask();

		return {
			container,
			component,
			user: flushingUser(
				userEvent.setup({
					advanceTimers: (ms) => {
						if (vi.isFakeTimers()) {
							vi.advanceTimersByTime(ms);
						}
					},
				}),
			),
			async setProps(next) {
				Object.assign(state, next);
				flushSync();
				await flushAfterMicrotask();
			},
			unmount: remove,
		};
	}

	const clock: Clock = {
		withFakeTimers() {
			beforeEach(() => {
				vi.useFakeTimers();
			});
			afterEach(() => {
				vi.useRealTimers();
			});
		},
		tick(ms) {
			vi.advanceTimersByTime(ms);
			flushSync();
		},
		runToLast() {
			vi.runOnlyPendingTimers();
			flushSync();
		},
		runAll() {
			vi.runAllTimers();
			flushSync();
		},
		restore() {
			vi.useRealTimers();
		},
	};

	return { render, clock };
}

/** Wraps every `user` action so Svelte's pending updates are applied when it resolves. */
function flushingUser(user: UserEvent): UserEvent {
	return new Proxy(user, {
		get(target, key, receiver) {
			const value = Reflect.get(target, key, receiver);
			if (typeof value !== "function") {
				return value;
			}
			return async (...args: unknown[]) => {
				const result = await (value as (...a: unknown[]) => unknown).apply(target, args);
				flushSync();
				return result;
			};
		},
	});
}
