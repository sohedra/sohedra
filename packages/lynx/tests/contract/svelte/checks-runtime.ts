// Rows that rest on what Svelte's runtime exports and does under a custom renderer.

import path from "node:path";

import { expect } from "@rstest/core";

import type { Checks } from "./check.ts";
import { compileClient, compileServer } from "./compile.ts";
import { mountComponent, treeRenderer } from "./runtime-fixture.ts";
import { SVELTE_ROOT, importNative, importSvelte } from "./svelte-package.ts";

interface RendererState {
	push_renderer(renderer: object | null): () => void;
}

const MARKUP = '<view id="a"><text>hello</text></view>';

/** A node as Svelte's development build leaves it. */
interface Located {
	__svelte_meta?: { loc?: unknown };
}

export const checks: Checks = {
	"push-renderer": async () => {
		// Boundary: Svelte's internal modules have no types.
		const state = (await importSvelte(
			"src/internal/client/custom-renderer/state.js",
		)) as unknown as RendererState;
		expect(typeof state.push_renderer).toBe("function");
		// Compiled components make their renderer current while they build, and restore the one before.
		const code = compileClient(MARKUP);
		expect(code).toMatch(/import \$renderer from '[^']+';/);
		expect(code).toContain("var $$pop_renderer = $.push_renderer($renderer);");
		expect(code).toContain("$$pop_renderer();");
		const internal = await importSvelte("src/internal/client/index.js");
		expect(typeof internal["push_renderer"]).toBe("function");
	},

	"events-read-current-renderer": async () => {
		// Boundary: Svelte's internal modules have no types.
		const state = (await importSvelte(
			"src/internal/client/custom-renderer/state.js",
		)) as unknown as RendererState;
		const events = await importSvelte("src/events/index.js");
		const on = events["on"] as (
			target: object,
			type: string,
			handler: (event: unknown) => void,
		) => () => void;
		type Listener = (this: unknown, event: unknown) => void;
		const listening: [string, string, Listener][] = [];
		const renderer = (name: string) => ({
			addEventListener: (_target: object, type: string, handler: Listener) =>
				listening.push([name, type, handler]),
			removeEventListener: (_target: object, type: string) =>
				listening.push([name, `-${type}`, () => {}]),
		});
		// A target with no listener methods: the DOM's path would fail on it.
		const target = {};
		const heard: unknown[] = [];
		const popKept = state.push_renderer(renderer("kept"));
		try {
			// An effect's renderer, then the one it found again once the effect ends.
			const popEffect = state.push_renderer(renderer("effect"));
			popEffect();
			const off = on(target, "tap", (event) => heard.push(event));
			off();
		} finally {
			popKept();
		}
		expect(listening.map(([name, type]) => [name, type])).toEqual([
			["kept", "tap"],
			["kept", "-tap"],
		]);
		// The handler it was given runs the developer's handler as it is, with no DOM propagation.
		const event = { type: "tap", target: {} };
		listening[0]![2].call(target, event);
		expect(heard).toEqual([event]);
	},

	"server-runtime-exports": async () => {
		const server = await importSvelte("src/internal/server/index.js");
		for (const name of ["attr", "attributes", "escape", "css_props"]) {
			expect(typeof server[name], name).toBe("function");
		}
		// The first frame's components write elements with these.
		expect(compileServer("<view id={x} {...el}>{x}</view>")).toMatch(/\$\.attributes\(/);
	},

	"reactivity-client-exports": async () => {
		const client = await importSvelte("src/reactivity/index-client.js");
		for (const name of [
			"SvelteDate",
			"SvelteSet",
			"SvelteMap",
			"SvelteURL",
			"SvelteURLSearchParams",
			"MediaQuery",
			"createSubscriber",
		]) {
			expect(typeof client[name], name).toBe("function");
		}
	},

	"mount-renderer-option": async () => {
		// `mount` takes the renderer as an option: without it, it sets up DOM event delegation.
		const { target } = await mountComponent(MARKUP);
		expect(target.children.map((node) => node.name)).toContain("view");
	},

	"dev-element-locations": async () => {
		// A development build records where each element of a template was written.
		const { target, file } = await mountComponent('<view id="a"></view>', true);
		// Boundary: the tree renderer's nodes, with the field Svelte adds.
		const nodes = target.children as unknown as (Located & { name?: string })[];
		const view = nodes.find((node) => node.name === "view");
		const fixture = path.basename(file).replace(/^fixture-(\d+)\.mjs$/, "Fixture$1.svelte");
		expect(view?.__svelte_meta?.loc).toMatchObject({ file: fixture, line: 1, column: 0 });
	},

	"unmount-synchronous": async () => {
		const mounted = await mountComponent(MARKUP);
		expect(mounted.target.children.length).toBeGreaterThan(0);
		const done = mounted.unmount();
		// The elements are gone before anything is awaited: a reload relies on this.
		expect(mounted.target.children).toEqual([]);
		expect(mounted.log).toContain("remove view");
		await done;
	},

	"hydration-off-under-renderer": async () => {
		const probe = await importNative(path.join(import.meta.dirname, "hydration-probe.ts"));
		// Boundary: the probe is loaded by Node, so its export type is declared here.
		const hydratingAround = probe["hydratingAround"] as (
			root: string,
			renderer: object,
		) => Promise<boolean[]>;
		// Making a renderer current turns hydration off, the way back turns it on again, and with
		// no renderer it stays as it was.
		const steps = await hydratingAround(SVELTE_ROOT, (await treeRenderer()).default);
		expect(steps).toEqual([false, true, true]);
	},
};
