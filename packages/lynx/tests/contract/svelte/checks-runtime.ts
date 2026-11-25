// Rows that rest on what Svelte's runtime exports and does under a custom renderer.

import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect } from "@rstest/core";
import { compile } from "svelte/compiler";

import type { Checks } from "./check.ts";
import { compileClient, compileServer } from "./compile.ts";
import {
	loadComponent,
	mountComponent,
	mountThrough,
	serverComponents,
	svelteClient,
	treeRenderer,
} from "./runtime-fixture.ts";
import { SVELTE_ROOT, importNative, importSvelte } from "./svelte-package.ts";

interface RendererState {
	push_renderer(renderer: object | null): object | null;
	pop_renderer(previous: object | null): void;
}

const MARKUP = '<view id="a"><text>hello</text></view>';

/** A node as Svelte's development build leaves it. */
interface Located {
	__svelte_meta?: { loc?: unknown };
}

interface Signals {
	state(value: unknown): object;
	get(signal: object): unknown;
	set(signal: object, value: unknown): void;
	derived(run: () => unknown): object;
	untrack(run: () => void): void;
	effect_root(run: () => void): () => void;
	render_effect(run: () => void): void;
}

export const checks: Checks = {
	"client-state-signals": async () => {
		// Boundary: Svelte's internal modules have no types.
		const internal = (await importSvelte("src/internal/client/index.js")) as unknown as Signals;
		const { flushSync } = (await importSvelte("src/index-client.js")) as unknown as {
			flushSync(): void;
		};
		const { state, get, set, untrack, effect_root, render_effect } = internal;
		const shown = state(false);
		const seen: unknown[] = [];
		const stop = effect_root(() => {
			render_effect(() => {
				seen.push(get(shown));
				// A write while an effect runs is allowed when it is untracked.
				if (seen.length === 1) untrack(() => set(shown, false));
			});
		});
		flushSync();
		untrack(() => set(shown, true));
		flushSync();
		stop();
		expect(seen).toEqual([false, true]);
		// While Svelte builds a block or computes a derived, a write throws unless it is untracked:
		// the renderer shows a row while a block effect inserts it.
		const { derived } = internal;
		const opened = state(false);
		const tracked = derived(() => set(opened, true));
		expect(() => get(tracked)).toThrow(/state_unsafe_mutation/);
		const untracked = derived(() => untrack(() => set(opened, true)));
		expect(() => get(untracked)).not.toThrow();
		expect(get(opened)).toBe(true);
	},

	"push-renderer": async () => {
		// Boundary: Svelte's internal modules have no types.
		const state = (await importSvelte(
			"src/internal/client/custom-renderer/state.js",
		)) as unknown as RendererState;
		expect(typeof state.push_renderer).toBe("function");
		expect(typeof state.pop_renderer).toBe("function");
		// Compiled components make their renderer current while they build, and restore the one before.
		const code = compileClient(MARKUP);
		expect(code).toMatch(/import \$renderer from '[^']+';/);
		expect(code).toContain("var $$previous_renderer = $.push_renderer($renderer);");
		expect(code).toContain("$.pop_renderer($$previous_renderer);");
		const internal = await importSvelte("src/internal/client/index.js");
		expect(typeof internal["push_renderer"]).toBe("function");
		expect(typeof internal["pop_renderer"]).toBe("function");
		// `push_renderer` gives back the renderer it replaced, which `pop_renderer` makes current again.
		const kept = {};
		const previous = state.push_renderer(kept);
		expect(state.push_renderer(null)).toBe(kept);
		state.pop_renderer(kept);
		state.pop_renderer(previous);
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
		const beforeKept = state.push_renderer(renderer("kept"));
		try {
			// An effect's renderer, then the one it found again once the effect ends.
			state.pop_renderer(state.push_renderer(renderer("effect")));
			const off = on(target, "tap", (event) => heard.push(event));
			off();
		} finally {
			state.pop_renderer(beforeKept);
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

	"events-module-exports": async () => {
		// The background's `svelte/events` re-exports all of it, with `on` wrapped.
		const events = await importSvelte("src/events/index.js");
		expect(Object.keys(events)).toEqual(["on"]);
	},

	"server-runtime-exports": async () => {
		const server = await importSvelte("src/internal/server/index.js");
		for (const name of ["attr", "attributes", "css_props"]) {
			expect(typeof server[name], name).toBe("function");
		}
		const constants = await importSvelte("src/constants.js");
		expect(constants["ELEMENT_PRESERVE_ATTRIBUTE_CASE"]).toBe(2);
		// Boundary: Svelte's internal modules have no types.
		const attributes = server["attributes"] as (
			attrs: Record<string, unknown>,
			hash?: string,
			classes?: unknown,
			styles?: unknown,
			flags?: number,
		) => string;
		expect(attributes({ spreadName: "x" }, undefined, undefined, undefined, 2)).toBe(
			' spreadName="x"',
		);
		// The first frame's components write elements with these.
		expect(compileServer("<view id={x} {...el}>{x}</view>")).toMatch(/\$\.attributes\(/);
		// An element's attributes, a spread's too, are read before its children, in the order
		// written: a list's count of initial rows opens in an attribute and its rows count after.
		const page = (
			await serverComponents(
				{
					Order: `<script>let { note } = $props();</script>
<view a={note("a")} {...{ b: note("b") }}>{#if note("c")}{/if}<text d={note("d")}>{note("e")}</text></view>`,
				},
				false,
			)
		)["default"];
		const { render } = await importSvelte("src/server/index.js");
		const read: string[] = [];
		// Boundary: Svelte's server `render` has no types here; it renders when its body is read.
		void (render as (component: unknown, options: object) => { body: string })(page, {
			props: { note: (name: string) => void read.push(name) },
		}).body;
		expect(read).toEqual(["a", "b", "c", "d", "e"]);
	},

	"server-markup-without-dev": async () => {
		// A sample through Svelte's own server runtime: blocks, snippets, spreads, `$props.id()`,
		// `--x` props, `<svelte:element>` and boundaries. The thread and generated tests are the broad
		// check: they hydrate a first frame compiled without `dev` with a development background.
		const sources = {
			Page: `<script>
	import Row from "./Row.svelte";
	let { rows, title, tag, waiting, ...rest } = $props();
	const id = $props.id();
</script>
{#snippet label(text)}<text class="label">{text}</text>{/snippet}
<view id={id} {...rest}>
	{#if title}<text>{title}</text>{:else}<view></view>{/if}
	<list>
		{#each rows as row, index (row)}
			{@const place = index + 1}
			<Row key={row} --tone="red">{@render label(\`\${place}. \${row}\`)}</Row>
		{:else}
			<text>none</text>
		{/each}
	</list>
	{#each [] as nothing}<text>{nothing}</text>{:else}<text>empty</text>{/each}
	{#key title}<text>{rows.length}</text>{/key}
	<svelte:element this={tag} class="dynamic"><text>inside</text></svelte:element>
	{#await waiting}<text>waiting</text>{:then value}<text>{value}</text>{/await}
	<svelte:boundary><text>b</text></svelte:boundary>
	<svelte:boundary>{#snippet pending()}<text>pending</text>{/snippet}<text>content</text></svelte:boundary>
</view>`,
			Row: `<script>
	let { key, children } = $props();
	const id = $props.id();
</script>
<list-item item-key={key} data-id={id}><view>{@render children?.()}</view></list-item>`,
		};
		const { render } = await importSvelte("src/server/index.js");
		const bodies: string[] = [];
		for (const dev of [true, false]) {
			const page = (await serverComponents(sources, dev))["default"];
			// Boundary: Svelte's server `render` has no types here.
			const rendered = (render as (component: unknown, options: object) => { body: string })(page, {
				props: {
					rows: ["a", "b"],
					title: "Feed",
					tag: "view",
					waiting: new Promise(() => {}),
					class: "page",
				},
				idPrefix: "lynx",
			});
			bodies.push(rendered.body);
		}
		for (const written of [
			'data-id="lynx-s2"',
			"--tone: red;",
			'<view class="dynamic">',
			"<text>empty</text>",
			"<text>waiting</text>",
			"<text>pending</text>",
		])
			expect(bodies[0]).toContain(written);
		expect(bodies[1]).toBe(bodies[0]);
		// Development output is where the element checks are, which the main thread's copy leaves out.
		expect(compile("<view></view>", { generate: "server", dev: true }).js.code).toContain(
			"$.push_element(",
		);
	},

	"server-render-await-invalid": async () => {
		const server = await importSvelte("src/internal/server/index.js");
		// Boundary: Svelte's internal modules have no types.
		const render = server["render"] as (component: unknown) => { body: string };
		const awaits = (renderer: { child(fn: () => Promise<void>): void }) =>
			renderer.child(async () => {});
		expect(() => render(awaits).body).toThrow(/^await_invalid\n/);
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

	"block-first-branch-sync": async () => {
		const file = path.join(import.meta.dirname, "branch-probe.ts");
		// Boundary: the probe is loaded by Node, so its export type is declared here.
		const probe = (await importNative(file)) as unknown as { seen: boolean[]; order: string[] };
		probe.seen.length = 0;
		// Blocks draw their first branch inside the call that makes them, nested as deep as they go:
		// each leaf is drawn while `Marked`'s call runs.
		await mountComponent(
			`<script>import { Marked, inMark } from "${pathToFileURL(file).href}"; let shown = $state(true);</script>` +
				"{#snippet body()}{#if shown}{#each [1, 2] as item (item)}{#key item}<svelte:boundary>" +
				"{#if shown}<view name={inMark()}></view>{/if}" +
				"</svelte:boundary>{/key}{/each}{/if}{/snippet}" +
				"<Marked render={body} />",
		);
		expect(probe.seen).toEqual([true, true]);
		// An `{#await}` reads what it is given inside the call that makes it, and draws a value's
		// `{:then}` there, an `{#await}` in it included: the blocks after each run after its own.
		probe.order.length = 0;
		await mountComponent(
			`<script>import { note } from "${pathToFileURL(file).href}";</script>` +
				"{#await note('outer', 1)}{:then}" +
				"{#await note('inner', 2)}{:then}<view></view>{/await}{#if note('inner after')}{/if}" +
				"{/await}{#if note('outer after')}{/if}",
		);
		expect(probe.order).toEqual(["outer", "inner", "inner after", "outer after"]);
	},

	"if-branch-number": async () => {
		const file = path.join(import.meta.dirname, "if-probe.ts");
		// Boundary: the probe is loaded by Node, so its export type is declared here.
		const probe = (await importNative(file)) as unknown as {
			runs: { keys: (number | false | undefined)[]; before: (string | undefined)[] }[];
		};
		const blocks =
			"{#if n === 0}<view></view>{:else if n === 1}<text></text>{:else}<image></image>{/if}" +
			"{#if n === 0}<list></list>{/if}";
		probe.runs.length = 0;
		const { app } = await mountThrough(
			`<script>let n = $state(0); export const set = (value) => (n = value);</script>${blocks}`,
			file,
		);
		const { flushSync } = await svelteClient();
		const drawn: string[] = [];
		const { render } = await importSvelte("src/server/index.js");
		const page = (
			await serverComponents({ Blocks: `<script>let { n } = $props();</script>${blocks}` }, false)
		)["default"];
		for (const n of [0, 1, 2]) {
			if (n > 0) {
				// Boundary: the fixture's export, typed by what it does.
				(app as { set(value: number): void }).set(n);
				flushSync();
			}
			// Boundary: Svelte's server `render` has no types here.
			const body = (render as (component: unknown, options: object) => { body: string })(page, {
				props: { n },
			}).body;
			drawn.push(...[...body.matchAll(/<!--\[(-?\d+)-->/g)].map((found) => found[1]!));
		}
		// Each run calls the branch's function once, with the server's number (none for 0), and the
		// branch is before the anchor once the call returns; none when no branch is taken.
		expect(probe.runs).toEqual([
			{ keys: [undefined], before: ["view"] },
			{ keys: [undefined], before: ["list"] },
			{ keys: [1], before: ["text"] },
			{ keys: [], before: [] },
			{ keys: [-1], before: ["image"] },
			{ keys: [], before: [] },
		]);
		expect(drawn).toEqual(["0", "0", "1", "-1", "-1", "-1"]);
		// Compiled code calls `$.if` with the anchor and the function, and `true` for `{:else if}`
		// when it is not folded into the block before it.
		expect(compileClient("{#if x}<view></view>{:else if el}<text></text>{/if}")).toMatch(
			/\$\.if\(node, \(\$\$render\) => \{/,
		);
	},

	"component-crossing-check": async () => {
		// A component checks first whether its renderer is the current one.
		expect(compileClient(MARKUP)).toMatch(
			/^\tif \(\$\.is_crossing\(\$renderer\)\) return \$\.cross\(\$renderer, /m,
		);
		// Under its own renderer, as `mount` makes it, it draws with it.
		const { file, target } = await mountComponent(MARKUP);
		expect(target.children.map((node) => node.name)).toContain("view");
		// Anywhere else it crosses, which a renderer with neither `embed` nor `host` cannot do.
		// Boundary: the compiled module is loaded by Node, so its type is declared here.
		const component = (await importNative(file))["default"] as (
			anchor: object,
			props: object,
		) => void;
		expect(() => component({}, {})).toThrow(/renderer_cannot_cross/);
	},

	"class-and-style-set-whole": async () => {
		// A canary: when only a text of the template changes and `class` and `style` are not set
		// again, the renderer's `unchanged-class-and-style` workaround can go.
		const { app, log } = await mountComponent(
			'<script>let n = $state(0); let x = $state("a"); export const tap = () => n++; export const tone = (v) => (x = v);</script>' +
				'<view class="b {x}" style="color: {x}"><text>{n}</text></view>',
		);
		const { flushSync } = (await importSvelte("src/index-client.js")) as unknown as {
			flushSync(): void;
		};
		// Boundary: the component's exports, as the markup above declares them.
		(app as { tap(): void }).tap();
		flushSync();
		expect(log).toEqual(["set view class", "set view style"]);
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

	"mount-renders-whole-tree": async () => {
		const runs: string[] = [];
		// Boundary: the component records on a global, which the check reads.
		(globalThis as { __mountRuns?: string[] }).__mountRuns = runs;
		try {
			const { component } = await loadComponent(
				"<script>const runs = globalThis.__mountRuns; const draw = (name) => (runs.push(name), name);" +
					'let items = [1, 2]; const later = new Promise(() => {}); $effect(() => { runs.push("effect"); });</script>' +
					'{#if items.length}<view name={draw("if")} {@attach () => { runs.push("attach"); }}>' +
					'{#each items as item}<text name={draw("each " + item)}>{item}</text>{/each}' +
					'<svelte:boundary><view name={draw("boundary")}>' +
					'{#key items}<view name={draw("key")}></view>{/key}</view></svelte:boundary>' +
					"</view>{/if}" +
					'<view>{#await later}<view name={draw("pending")}></view>{:then}<view></view>{/await}</view>',
			);
			const renderer = await treeRenderer();
			const client = await svelteClient();
			const app = client.mount(component, {
				target: renderer.createRoot(),
				renderer: renderer.default,
			});
			// The first branch of `{#if}`, `{#each}`, `{#key}` and `<svelte:boundary>` is drawn by the
			// time `mount` returns, and no effect has run.
			expect(runs.toSorted()).toEqual(["boundary", "each 1", "each 2", "if", "key"]);
			// `{#await}` draws its pending branch only in a task it queues, which a flush runs before
			// the effects: it comes after the rendered items, and the first frame marks the block.
			client.flushSync();
			expect(runs.slice(5).toSorted()).toEqual(["attach", "effect", "pending"]);
			await client.unmount(app);
		} finally {
			delete (globalThis as { __mountRuns?: string[] }).__mountRuns;
		}
	},

	"server-await-block": async () => {
		// Boundary: Svelte's internal modules have no types.
		const server = (await importSvelte("src/internal/server/index.js")) as unknown as {
			await(
				renderer: { push(html: string): void },
				promise: unknown,
				pending: (() => void) | null,
				then: ((value: unknown) => void) | null,
			): void;
		};
		const pushed: string[] = [];
		const drawn: string[] = [];
		const renderer = { push: (html: string) => void pushed.push(html) };
		server.await(
			renderer,
			new Promise(() => {}),
			() => void drawn.push("pending"),
			() => void drawn.push("then"),
		);
		server.await(
			renderer,
			"value",
			() => void drawn.push("pending"),
			(value) => {
				drawn.push(`then ${String(value)}`);
			},
		);
		expect(pushed).toEqual(["<!--[-->", "<!--[!-->"]);
		expect(drawn).toEqual(["pending", "then value"]);
		// The compiled component's branches write through its own renderer, not the one `await` is
		// given.
		const compiled = compileServer("{#await p}<text>a</text>{:then v}<text>{v}</text>{/await}");
		expect(compiled).toMatch(/\$\.await\(\s*\$\$renderer,/);
		expect(compiled).toMatch(/\(\) => \{\s*\$\$renderer\.push\(`<text>a<\/text>`\);/);
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
