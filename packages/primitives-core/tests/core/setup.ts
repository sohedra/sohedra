// Core runs on any platform: its time comes from `platform.scheduler`, never from the host's
// timer globals. Each core test runs with them replaced by stubs that throw, so a global that
// slipped past lint fails here. (`queueMicrotask` stays: Svelte schedules its flushes with it.)
import { afterEach, beforeEach, vi } from "vitest";

const TIMER_GLOBALS = [
	"setTimeout",
	"clearTimeout",
	"setInterval",
	"clearInterval",
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"requestIdleCallback",
	"cancelIdleCallback",
] as const;

function forbidden(name: string) {
	return () => {
		throw new Error(`Core called the ${name} global: use the platform's scheduler.`);
	};
}

beforeEach(() => {
	for (const name of TIMER_GLOBALS) {
		vi.stubGlobal(name, forbidden(name));
	}
	vi.stubGlobal("performance", {
		get now() {
			return forbidden("performance.now")();
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});
