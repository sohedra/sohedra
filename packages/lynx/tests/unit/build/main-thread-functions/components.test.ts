// Main-thread functions in a component: its scripts are read as written, so both threads get the
// same ids; the main thread's registrations go to module level; a function written in markup
// moves into the script.

import { describe, expect, it } from "@rstest/core";

import { compileScript, component } from "../compiling.ts";
import { readOutput, registrationsOf } from "./output.ts";

const scroll = `<script lang="ts">
  import { mainThreadRef, runOnBackground } from '@sohedra/lynx';
  let count = $state(0);
  const box = mainThreadRef(null);
  function save(n: number) { count = n; }
  function onScroll(event: { detail: { scrollTop: number } }) {
    'main thread';
    box.current?.setStyleProperty('opacity', '0.5');
    runOnBackground(save)(event.detail.scrollTop);
  }
</script>

<scroll-view main-thread:onscroll={onScroll}><text>{count}</text></scroll-view>
`;

describe("main-thread functions in a component", () => {
	it("gives both threads the same ids, and registers the body under it on the main thread", async () => {
		const background = await component(scroll, { thread: "background" });
		const mainThread = await component(scroll, { thread: "main-thread" });
		expect(background.functionIds).toHaveLength(1);
		expect(mainThread.functionIds).toEqual(background.functionIds);
		expect(mainThread.code).toContain(
			`registerWorkletInternal("main-thread", "${background.functionIds[0]}"`,
		);
		expect(readOutput(background.code).functions.map((fn) => fn.id)).toEqual(
			background.functionIds,
		);
	});

	it("keeps what only the markup uses, and the state", async () => {
		for (const thread of ["background", "main-thread"] as const) {
			const { code } = await component(scroll, { thread });
			expect(code).toContain("onScroll");
			expect(code).toContain("count");
		}
	});

	it("puts the registrations outside the component, so they run at module load", async () => {
		const mainThread = await component(scroll, { thread: "main-thread" });
		const component_ = mainThread.code.slice(
			0,
			mainThread.code.indexOf("\nimport { loadWorkletRuntime"),
		);
		expect(component_).not.toContain("registerWorkletInternal");
		expect(registrationsOf(mainThread.code)).toMatch(
			/^\nimport \{ loadWorkletRuntime as __svelteLynxLoadWorkletRuntime \} from "@sohedra\/lynx\/internal\/main-thread-functions";/,
		);
		expect((await component(scroll, { thread: "background" })).code).not.toContain(
			"registerWorkletInternal",
		);
	});

	it("leaves a component without main-thread functions as Svelte compiles it", async () => {
		const plain = "<script>let a = 1;</script><text>{a}</text>";
		for (const thread of ["background", "main-thread"] as const) {
			const { code, functionIds } = await component(plain, { thread });
			expect(functionIds).toEqual([]);
			expect(code).not.toContain("_wkltId");
			expect(code).not.toContain("registerWorkletInternal");
		}
	});

	it("accepts the 'main-thread' spelling of the directive", async () => {
		const source = `<script>function f() { 'main-thread'; return 1; }</script><view main-thread:ontap={f}></view>`;
		expect((await component(source)).functionIds).toHaveLength(1);
		expect(compileScript(`export function f() { 'main-thread'; return 1; }\n`).ids).toHaveLength(1);
	});

	it('reads a lang="ts" script as TypeScript', async () => {
		const source = `<script lang="ts">
  const id = <T,>(x: T) => x;
  const n = <number>(<unknown>1);
  function f() { 'main thread'; return id(n); }
</script>
<view main-thread:ontap={f}></view>`;
		expect((await component(source)).functionIds).toHaveLength(1);
	});
});

describe("captured values of a component", () => {
	const source = `<script lang="ts">
  let { threshold = 100 }: { threshold?: number } = $props();
  let cfg = $state({ a: 1 });
  let items = $state([1, 2]);
  function onScroll(event: { detail: { scrollTop: number } }) {
    'main thread';
    if (event.detail.scrollTop > threshold + cfg.a) for (const item of items) console.log(item);
  }
  function still() {
    'main thread';
    return 1;
  }
</script>

<scroll-view main-thread:onscroll={onScroll} main-thread:ontap={still}></scroll-view>
`;

	it("are derived on the background, so the handler follows them", async () => {
		const { code } = await component(source, { thread: "background" });
		expect(code).toMatch(/let onScroll = \$\.derived\(/);
		expect(code).toMatch(/_c: \{\s*threshold: threshold\(\)/);
	});

	it("read captured $state objects through a snapshot, so changes inside them count", async () => {
		const { code } = await component(source, { thread: "background" });
		expect(code).toContain("items: $.snapshot(items)");
		expect(code).toContain("a: $.snapshot(cfg.a)");
		expect(code).not.toContain("$.snapshot(threshold");
	});

	it("leave functions without captures, and the first frame, as they are", async () => {
		const background = await component(source, { thread: "background" });
		expect(background.code).toMatch(/let still = \{\s*_wkltId/);
		const mainThread = await component(source, { thread: "main-thread" });
		expect(mainThread.code).not.toContain("$.derived");
		expect(mainThread.code).not.toContain("snapshot");
	});
});

describe("names of the module script", () => {
	const source = `<script module lang="ts">
  import { clamp } from './worklets.ts';
  import { theme } from './theme.ts' with { runtime: 'shared' };
  const limit = 3;
  function helper(v: number) { 'main thread'; return v * 2; }
  function plain() {}
</script>
<script lang="ts">
  let x = $state(1);
  const onTap = () => { 'main thread'; console.log(helper(clamp(x)), limit, theme); };
  const onMove = () => { 'main thread'; plain(); };
</script>
<view main-thread:ontap={onTap} main-thread:ontouchmove={onMove}></view>
<view main-thread:ontap={() => { 'main thread'; console.log(limit); }}></view>`;

	it("are captured by the instance script's functions and the markup's, except shared imports", async () => {
		for (const thread of ["background", "main-thread"] as const) {
			const { code } = await component(source, { thread });
			expect(readOutput(code).functions.map((fn) => fn.captures)).toEqual([
				[],
				["helper", "clamp", "x", "limit"],
				["plain"],
				["limit"],
			]);
		}
	});

	it("are unpacked on the main thread", async () => {
		const { code } = await component(source, { thread: "main-thread" });
		expect(registrationsOf(code)).toContain('let { helper, clamp, x, limit } = this["_c"];');
	});

	it("are checked in development when the body calls a plain function", async () => {
		const { code } = await component(source, { development: true });
		expect(code).toContain("`plain` is a plain function");
	});

	it("give way to an instance script's own name", async () => {
		const shadowed = `<script module>const limit = 3;</script>
<script>const limit = 4; const onTap = () => { 'main thread'; console.log(limit); };</script>
<view main-thread:ontap={onTap}></view>`;
		const { code } = await component(shadowed);
		expect(readOutput(code).functions.map((fn) => fn.values)).toEqual([["limit = limit"]]);
	});
});

describe("inline main-thread functions in markup", () => {
	const source = `<script lang="ts">
  let opacity = $state('0.5');
</script>

<view main-thread:ontap={(event: any) => {
  'main thread';
  event.currentTarget.setStyleProperty('opacity', opacity);
}}></view>
<text>after</text>
`;

	it("move into the script, with the same ids on both threads", async () => {
		const background = await component(source, { thread: "background" });
		const mainThread = await component(source, { thread: "main-thread" });
		expect(background.code).toMatch(/const __mainThread0 = \$\.derived\(/);
		expect(background.code).toContain("$.get(__mainThread0)");
		expect(background.functionIds).toHaveLength(1);
		expect(mainThread.functionIds).toEqual(background.functionIds);
		expect(mainThread.code).toContain("event.currentTarget.setStyleProperty('opacity', opacity)");
	});

	it("work without a script", async () => {
		const bare = `<view main-thread:ontap={() => { 'main thread'; console.log('tap'); }}></view>`;
		const { code, functionIds } = await component(bare);
		expect(functionIds).toHaveLength(1);
		expect(code).toContain("__mainThread0");
	});

	it("may use the script, but not names that only exist inside the markup", async () => {
		const each = `<script lang="ts">let rows = $state([{ id: 1 }]);</script>
{#each rows as row (row.id)}
  <view main-thread:ontap={() => { 'main thread'; console.log(row.id, rows.length); }}></view>
{/each}`;
		await expect(component(each)).rejects.toThrow(
			/`main-thread:ontap` uses `row`, which only exists inside the markup/,
		);
		const error = await component(each).catch((thrown: Error) => thrown);
		expect((error as Error).message).toMatch(/Component\.svelte:3:\d+/);
		expect(await component(each.replace("row.id, rows", "rows"))).toMatchObject({
			functionIds: [expect.any(String)],
		});
	});
});

describe("main-thread functions in a script of a module", () => {
	it("leaves import() alone", () => {
		const { code } = compileScript(
			`export const load = () => import('./lazy.ts');\nexport function f() { 'main thread'; return 1; }\n`,
		);
		expect(code).toContain("_wkltId");
		expect(code).toContain("import('./lazy.ts')");
	});

	it("parses .ts as TypeScript, not TSX: generics and angle-bracket casts", () => {
		const { ids } = compileScript(
			`export const id = <T>(x: T) => x;\nexport const n = <number>(<unknown>1);\nexport function f() { 'main thread'; return 1; }\n`,
			{ file: "generic.ts" },
		);
		expect(ids).toHaveLength(1);
	});
});

describe("names that exist only in the markup", () => {
	const wrap = (markup: string): string =>
		`<script>let rows = $state([{ id: 1 }]); let p = Promise.resolve(1);</script>\n${markup}`;
	const tap = (name: string): string =>
		`<view main-thread:ontap={() => { 'main thread'; console.log(${name}); }}></view>`;

	it.each([
		["an {#each} item, destructured", `{#each rows as { id }}${tap("id")}{/each}`, "id"],
		["an {#each} index", `{#each rows as row, index (row.id)}${tap("index")}{/each}`, "index"],
		["a snippet's parameter", `{#snippet item(label)}${tap("label")}{/snippet}`, "label"],
		["a {@const}", `{#if true}{@const doubled = 2}${tap("doubled")}{/if}`, "doubled"],
		["a {:then} value", `{#await p then value}${tap("value")}{/await}`, "value"],
		["a {:catch} error", `{#await p}{:catch failure}${tap("failure")}{/await}`, "failure"],
		[
			"an item two blocks up",
			`{#each rows as row (row.id)}{#key row}${tap("row")}{/key}{/each}`,
			"row",
		],
		[
			"an item in the else of an if",
			`{#each rows as row (row.id)}{#if false}{:else}${tap("row")}{/if}{/each}`,
			"row",
		],
	])("%s is an error that names it", async (_, markup, name) => {
		const error = (await component(wrap(markup)).catch((thrown: Error) => thrown)) as Error & {
			code?: string;
		};
		expect(error.code).toBe("main_thread_function_block_name");
		expect(error.message).toContain(`\`${name}\``);
	});

	it("leaves a name the function declares itself, and the script's, alone", async () => {
		const ok = wrap(
			`{#each rows as row (row.id)}<view main-thread:ontap={(event) => { 'main thread'; const row = event; console.log(row, rows.length); }}></view>{/each}`,
		);
		expect((await component(ok)).functionIds).toHaveLength(1);
	});
});
