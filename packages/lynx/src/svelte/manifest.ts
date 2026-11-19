/** Where the binding's own code touches Svelte: its compiler, its internals or its source files. */
export type ContractProgram = "build" | "runtime";

/** One place the binding rests on the pinned Svelte build. */
export interface ContractRow {
	/** A stable name in kebab-case; the contract test's check for this row carries it. */
	readonly id: string;
	/** `build` runs in Node, when an app is built; `runtime` runs on a Lynx thread. */
	readonly program: ContractProgram;
	/** The file of the Svelte package the row rests on, relative to the package's folder. */
	readonly file: string;
	/** Text the file must contain: the line, export or name the binding looks for. */
	readonly anchor: string;
	/** What the binding relies on, as a statement that is true of the pinned build. */
	readonly reliesOn: string;
	/** The module that holds the row's check, relative to the binding's folder. */
	readonly test: string;
}

const SOURCE = "tests/contract/svelte/checks-source.ts";
const COMPILER = "tests/contract/svelte/checks-compiler.ts";
const RUNTIME = "tests/contract/svelte/checks-runtime.ts";

/**
 * Every place the binding touches Svelte's internals, with the check that tells an upgrade what to
 * revisit. `tests/contract/svelte/svelte-contract.test.ts` walks it: a row without a check fails.
 */
export const SVELTE_CONTRACT: readonly ContractRow[] = [
	// How components are compiled and what comes out
	{
		id: "custom-renderer-compile-options",
		program: "build",
		file: "src/compiler/validate-options.js",
		anchor: "customRenderer: validator(",
		reliesOn:
			"`experimental.customRenderer`, `fragments: 'tree'` and `css: 'external'` are compile options, and a component compiles to a template built with `$.from_tree`",
		test: COMPILER,
	},
	{
		id: "component-export-shape",
		program: "build",
		file: "src/compiler/phases/3-transform/client/transform-client.js",
		anchor: "b.export_default",
		reliesOn:
			"the output holds `export default function Name(`, so the first frame's twin of a component can find the name",
		test: COMPILER,
	},
	{
		id: "internal-import-specifiers",
		program: "build",
		file: "src/compiler/phases/3-transform/client/transform-client.js",
		anchor: "svelte/internal/client",
		reliesOn:
			"compiled components import `svelte/internal/client` (background) and `svelte/internal/server` (main thread) as plain strings, which the build points at its own modules",
		test: COMPILER,
	},
	{
		id: "no-init-operations",
		program: "build",
		file: "src/internal/init-operations.js",
		anchor: "init_operations",
		reliesOn:
			"a component compiled for a custom renderer never imports the DOM's operations module",
		test: COMPILER,
	},
	{
		id: "hot-reload-footer",
		program: "build",
		file: "src/compiler/phases/3-transform/client/transform-client.js",
		anchor: "import.meta.hot.accept",
		reliesOn:
			"`hmr: true` ends a component with the exact `import.meta.hot` footer that the build rewrites for a bundler that is not Vite",
		test: COMPILER,
	},
	{
		id: "template-node-shapes",
		program: "build",
		file: "src/compiler/phases/1-parse/read/options.js",
		anchor: "customRenderer",
		reliesOn:
			"the parsed template has `RegularElement`, `SvelteElement`, `Attribute` (a bare one has the value `true`, a shorthand starts at its `{`), `SpreadAttribute`, `ExpressionTag`, `ConstTag`, `EachBlock` (with its key expression and body) and `SvelteBoundary` nodes, `<svelte:options>` attributes in `options.attributes`, a script's program with positions in the whole component, and `ImportExpression` in scripts",
		test: COMPILER,
	},
	{
		id: "const-tag-places",
		program: "build",
		file: "src/compiler/phases/2-analyze/visitors/ConstTag.js",
		anchor: "e.const_tag_invalid_placement(node);",
		reliesOn:
			"a `{@const}` may stand in the fragment of an `{#each}` (`body`, `fallback`), an `{#if}` (`consequent`, `alternate`), a `{#key}`, an `{#await}` (`pending`, `then`, `catch`), a snippet (`body`), a component's children or a `<svelte:boundary>` (`fragment`), and not directly in an element: the build makes each deferred row's state with one",
		test: COMPILER,
	},
	{
		id: "server-drops-handlers-and-effects",
		program: "build",
		file: "src/compiler/phases/3-transform/server/visitors/shared/element.js",
		anchor: "} else if (is_event_attribute(attribute)) {",
		reliesOn:
			"the server output leaves out an element's `on…` attributes and the body of every `$effect`, so the build writes them again for the first frame",
		test: COMPILER,
	},
	{
		id: "attribute-effect-spread",
		program: "runtime",
		file: "src/internal/client/dom/elements/attributes.js",
		anchor: "} else if (typeof value !== 'function') {",
		reliesOn:
			"a spread compiles to `$.attribute_effect(element, () => props)`, and a function in a spread reaches the renderer only under an `on…` name",
		test: COMPILER,
	},
	// What the compiler refuses, and what it crashes on
	{
		id: "options-unrecognised-error",
		program: "build",
		file: "src/compiler/errors.js",
		anchor: "export function options_unrecognised",
		reliesOn:
			"a Svelte without custom renderers fails on `experimental.customRenderer` with the code `options_unrecognised`, which the setup check turns into advice",
		test: COMPILER,
	},
	{
		id: "incompatible-with-custom-renderer-error",
		program: "build",
		file: "src/compiler/errors.js",
		anchor: "export function incompatible_with_custom_renderer",
		reliesOn:
			'each banned feature fails with `incompatible_with_custom_renderer` and a first line of the form "`feature` is not compatible with `customRenderer`", which the binding extends with what exists instead',
		test: COMPILER,
	},
	{
		id: "supported-features-compile",
		program: "build",
		file: "src/compiler/phases/2-analyze/index.js",
		anchor: "incompatible_with_custom_renderer",
		reliesOn:
			"`{@attach}`, `use:`, `class:`, `style:`, spreads, `<svelte:element>`, `{#await}`, `{#key}` and `<svelte:boundary onerror>` compile under a custom renderer",
		test: COMPILER,
	},
	{
		id: "boundary-needs-async",
		program: "build",
		file: "src/compiler/phases/3-transform/client/visitors/SvelteBoundary.js",
		anchor: "snippet_fn.body.body.unshift(",
		reliesOn:
			"a `<svelte:boundary>` with a `failed` or `pending` snippet crashes the compiler (`reading 'body'`) unless `experimental.async` is on; the binding turns the crash into a clear error, and this row tells us when Svelte fixes it",
		test: COMPILER,
	},
	// Text the build rewrites or reads
	{
		id: "spread-props-setter-anchors",
		program: "build",
		file: "src/internal/client/reactivity/props.js",
		anchor: "return new Proxy({ props }, spread_props_handler);",
		reliesOn:
			"`spread_props` returns that Proxy and `prop()` finds a binding's setter with `get_descriptor(props, key)?.set ??`, each line once; the file imports `get_descriptor` and `is_function`; the Proxy's own `set` walks `target.props` from the last",
		test: SOURCE,
	},
	{
		id: "valid-tag-name-regex",
		program: "build",
		file: "src/utils.js",
		anchor: "export const REGEX_VALID_TAG_NAME =",
		reliesOn:
			"the tag-name regex is a `/u` regex with an astral escape, which Lynx's main-thread engine cannot compile, so the build rewrites it",
		test: SOURCE,
	},
	{
		id: "invalid-attribute-name-regex",
		program: "build",
		file: "src/internal/server/index.js",
		anchor: "const INVALID_ATTR_NAME_CHAR_REGEX =",
		reliesOn:
			"the attribute-name regex of the server runtime (the first frame) is a `/u` regex with astral escapes, which the build rewrites",
		test: SOURCE,
	},
	{
		id: "async-hooks-import",
		program: "build",
		file: "src/internal/server/render-context.js",
		anchor: "import('node:async_hooks')",
		reliesOn:
			"only async server rendering loads `node:async_hooks`, by a dynamic import, so the first frame's build leaves it out",
		test: SOURCE,
	},
	{
		id: "crypto-import",
		program: "build",
		file: "src/internal/server/crypto.js",
		anchor: "const obfuscated_import = (module_name) => import(/* @vite-ignore */ module_name);",
		reliesOn:
			"the server's hash helper imports `crypto` through an expression the first frame never runs, which the build keeps quiet",
		test: SOURCE,
	},
	{
		id: "svelte-own-dependencies",
		program: "build",
		file: "package.json",
		anchor: '"@sveltejs/acorn-typescript"',
		reliesOn:
			"Svelte depends on `acorn`, `@sveltejs/acorn-typescript` and `esm-env`, and the binding reads them from Svelte's own copy, so no app installs them",
		test: SOURCE,
	},
	// Names the first frame and the pages rely on
	{
		id: "void-element-names",
		program: "runtime",
		file: "src/utils.js",
		anchor: "const VOID_ELEMENT_NAMES = [",
		reliesOn:
			"Svelte's void elements are the sixteen names the first frame's parser ends at their opening tag",
		test: SOURCE,
	},
	{
		id: "server-runtime-exports",
		program: "runtime",
		file: "src/internal/server/index.js",
		anchor: "export { attr, clsx };",
		reliesOn:
			"`svelte/internal/server` exports `attr`, `attributes` and `css_props`, which the first frame's replacement of the server runtime overrides, and `attributes` keeps a spread's names' case with the flag `ELEMENT_PRESERVE_ATTRIBUTE_CASE` (2); the server reads an element's attributes, a spread's too, in the order written and before its children, so a list's first screen opens in an attribute and its rows count after",
		test: RUNTIME,
	},
	{
		id: "server-block-markers",
		program: "runtime",
		file: "src/compiler/phases/3-transform/server/visitors/IfBlock.js",
		anchor: "prepend_block_marker(final_alternate, `<!--[-1-->`);",
		reliesOn:
			"the server writes an `{#if}`'s branch between `<!--[0-->` (`<!--[1-->`…, `<!--[-1-->` for the else) and `<!--]-->`, and a component's fragment, an `{#each}` and a `{#key}` between `<!--[-->` and `<!--]-->`: the first frame's parser keeps the branches, where the background may render otherwise, and reads through the rest",
		test: SOURCE,
	},
	{
		id: "props-id-order",
		program: "runtime",
		file: "src/internal/server/renderer.js",
		anchor: "this.uid = () =>",
		reliesOn:
			"the server's `$props.id()` gives `<idPrefix>-s1`, `-s2`… in the order the components render, from 1 for each render, and a client component calls `$.props_id()`, which the background's client runtime replaces with the same ids, counted on Svelte's own `globalThis.__svelte.uid`",
		test: SOURCE,
	},
	{
		id: "if-block-branches",
		program: "build",
		file: "src/compiler/phases/1-parse/state/tag.js",
		anchor: "elseif: true,",
		reliesOn:
			"an `{#if}` parses to an `IfBlock` with its `test` and its `consequent` and `alternate` fragments, whose nodes have positions in the component, and an `{:else if}` to an `IfBlock` marked `elseif`, alone in the alternate of the one before: the build wraps a branch only one thread renders by those positions",
		test: COMPILER,
	},
	{
		id: "thread-branch-component",
		program: "runtime",
		file: "src/compiler/phases/3-transform/client/transform-client.js",
		anchor: "component_block.body.unshift(b.const(analysis.props_id, b.call('$.props_id')));",
		reliesOn:
			"a component in markup compiles to a call of its function with its anchor (client) or `$$renderer` (server) and its props, a snippet passed as a prop is a function of that one argument that renders there when called, and a component calls `$.props_id()` first: so `ThreadBranch`, a plain function, draws its branch at once, and the components in it take their ids while it does",
		test: COMPILER,
	},
	{
		id: "block-first-branch-sync",
		program: "runtime",
		file: "src/internal/client/dom/blocks/branches.js",
		anchor: "branch(() => fn(this.anchor))",
		reliesOn:
			"a client block (`{#if}`, `{#each}`, `{#key}`, `<svelte:boundary>`) draws its first branch inside the call that makes it, as deep as blocks nest: so every component a branch only one thread renders holds starts while `ThreadBranch` marks the branch",
		test: RUNTIME,
	},
	{
		id: "server-render-global",
		program: "runtime",
		file: "src/internal/server/renderer.js",
		anchor: "const head = new Renderer(this.global, this);",
		reliesOn:
			"a server render makes one `global` state and gives it to every renderer of that render, so the first frame counts the ids of a branch only one thread renders on `renderer.global`, from the first in each render",
		test: SOURCE,
	},
	{
		id: "server-markup-without-dev",
		program: "build",
		file: "src/compiler/phases/3-transform/server/visitors/RegularElement.js",
		anchor: "'$.push_element',",
		reliesOn:
			"a server render compiled without `dev` writes the same markup, block markers and `$props.id()` ids as one compiled with it, whose additions are checks (`push_element` and `pop_element` around each element, for HTML's nesting rules): so the main thread's copy compiles without `dev`, and the background's development copy hydrates it. The check renders a sample through Svelte's own server runtime; the thread and generated tests, which hydrate such a first frame with a development background, are the broad check",
		test: RUNTIME,
	},
	{
		id: "server-render-await-invalid",
		program: "runtime",
		file: "src/internal/server/errors.js",
		anchor: "export function await_invalid() {",
		reliesOn:
			"reading the `body` of a synchronous render throws an error whose message starts with `await_invalid` when a component awaits outside a `pending` boundary: the page then has no first frame",
		test: RUNTIME,
	},
	// What runs on a thread
	{
		id: "push-renderer",
		program: "runtime",
		file: "src/internal/client/custom-renderer/state.js",
		anchor: "export function push_renderer",
		reliesOn:
			"`svelte/internal/client` exports `push_renderer`, and a compiled component imports its renderer as a default export and makes it current for the time it builds",
		test: RUNTIME,
	},
	{
		id: "client-state-signals",
		program: "runtime",
		file: "src/internal/client/index.js",
		anchor:
			"export { mutable_source, mutate, set, state, update, update_pre } from './reactivity/sources.js';",
		reliesOn:
			"`svelte/internal/client` exports `state`, `get` and `set`, the signal `$state` compiles to: an effect that `get`s it re-runs when it is `set`, and an untracked `set` is allowed while an effect runs. A deferred row's `{#if}` reads one",
		test: RUNTIME,
	},
	{
		id: "events-read-current-renderer",
		program: "runtime",
		file: "src/internal/client/dom/elements/events.js",
		anchor: "var is_custom_renderer = current_renderer != null;",
		reliesOn:
			"`on()` reads the current renderer when it is called, to add the listener through it and to run the handler without the DOM's propagation; so the background's `on()`, which makes the page's renderer current around Svelte's, listens through it wherever it is called",
		test: RUNTIME,
	},
	{
		id: "css-props-holder",
		program: "runtime",
		file: "src/compiler/phases/3-transform/client/visitors/shared/component.js",
		anchor: "b.stmt(fn(b.member(anchor, 'lastChild'))),",
		reliesOn:
			"a component given `--x` props is wrapped in an element tagged `svelte-css-wrapper` or `g` (`CSS_PROPS_HOLDERS`), and placed at the wrapper's `lastChild`, which Svelte reads before the wrapper is on the page: the renderer makes the wrapper a `<view>` then",
		test: COMPILER,
	},
	{
		id: "events-module-exports",
		program: "runtime",
		file: "src/events/index.js",
		anchor: "export { on } from",
		reliesOn:
			"`svelte/events` exports only `on`, so the background's `svelte/events` (`src/svelte/runtime/events.ts`, which the build resolves it to) has all of it",
		test: RUNTIME,
	},
	{
		id: "renderer-cleared-by-async-context",
		program: "runtime",
		file: "src/internal/client/reactivity/async.js",
		anchor: "set_renderer(null);",
		reliesOn:
			"only `unset_context` clears the current renderer, and only an `{#await}` block, async deriveds and an async component's `await` call it: a renderer made current outside effects does not last, so `on()` makes its own current",
		test: SOURCE,
	},
	{
		id: "mount-renderer-option",
		program: "runtime",
		file: "src/internal/client/render.js",
		anchor: "if (options.renderer) {",
		reliesOn:
			"`mount` takes the renderer as an option, and without it sets up DOM event delegation, which Lynx has no document for",
		test: RUNTIME,
	},
	{
		id: "unmount-synchronous",
		program: "runtime",
		file: "src/internal/client/render.js",
		anchor: "export function unmount(",
		reliesOn:
			"`unmount` takes the component's nodes out before it returns, without awaiting its promise, which a page reload relies on",
		test: RUNTIME,
	},
	{
		id: "dev-element-locations",
		program: "runtime",
		file: "src/internal/client/dev/elements.js",
		anchor: "element.__svelte_meta = {",
		reliesOn:
			"a development build gives each element a template makes `__svelte_meta.loc`, its component's file, line and column, which the renderer's warnings name",
		test: RUNTIME,
	},
	{
		id: "dev-error-component-lines",
		program: "runtime",
		file: "src/internal/client/error-handling.js",
		anchor: "[FILENAME].split('/').pop()",
		reliesOn:
			"a development build adds a line `in File.svelte` for each component, innermost first, under the message of an error that leaves an effect, which names the component `onError` hears of",
		test: SOURCE,
	},
	{
		id: "hydration-off-under-renderer",
		program: "runtime",
		file: "src/internal/client/custom-renderer/state.js",
		anchor: "should_disable_hydration",
		reliesOn:
			"making a renderer current turns Svelte's own hydration off only while it is on, and the way back turns it on again: the background never runs Svelte's `hydrate` (the first frame is adopted on the main thread, and the entry mounts), so the renderer made current around effects, handlers and `on()` never meets it",
		test: RUNTIME,
	},
	// The globals Svelte's runtime reads that Lynx's threads lack, which the binding fills on both
	{
		id: "runtime-reads-event-target",
		program: "runtime",
		file: "src/internal/shared/clone.js",
		anchor: "if (value instanceof EventTarget) {",
		reliesOn:
			"only copying state (`$state.snapshot`, `$inspect`, `{@debug}`) and walking an action's object read the global `EventTarget`, unguarded, which the binding fills on both threads",
		test: SOURCE,
	},
	{
		id: "runtime-reads-structured-clone",
		program: "runtime",
		file: "src/internal/shared/clone.js",
		anchor: "structuredClone(value)",
		reliesOn:
			"only copying state calls the global `structuredClone`, unguarded, for each value that is not an array, a plain object, a `Map` or a `Set`, which the binding fills on both threads",
		test: SOURCE,
	},
	// Svelte's modules that read the window or the DOM when they load
	{
		id: "disclose-version-window-guard",
		program: "runtime",
		file: "src/internal/disclose-version.js",
		anchor: "if (typeof window !== 'undefined') {",
		reliesOn: "every component imports this module, and it touches `window` only where one exists",
		test: SOURCE,
	},
	{
		id: "dom-url-in-src-url-equal",
		program: "build",
		file: "src/internal/client/dom/elements/attributes.js",
		anchor: "function src_url_equal(element_src, url) {",
		reliesOn:
			"the one place the DOM code names `URL` is a function that returns early under a custom renderer, so the build gives it an empty module",
		test: SOURCE,
	},
	{
		id: "urls-named-in-three-files",
		program: "build",
		file: "src/reactivity/url.js",
		anchor: "SvelteURL",
		reliesOn:
			"only three of Svelte's client and shared files name `URL` or `URLSearchParams`, so a page that uses neither carries no URL code",
		test: SOURCE,
	},
	{
		id: "url-class-extends-global",
		program: "build",
		file: "src/reactivity/url.js",
		anchor: "export class SvelteURL extends URL {",
		reliesOn:
			"`SvelteURL` extends the global when its module loads, which counts as a side effect the build marks away",
		test: SOURCE,
	},
	{
		id: "url-search-params-class-extends-global",
		program: "build",
		file: "src/reactivity/url-search-params.js",
		anchor: "export class SvelteURLSearchParams extends URLSearchParams {",
		reliesOn: "the same, for `SvelteURLSearchParams`",
		test: SOURCE,
	},
	{
		id: "package-declares-no-side-effects",
		program: "build",
		file: "package.json",
		anchor: '"exports"',
		reliesOn:
			"Svelte's package has no `sideEffects` field, so a bundler keeps modules that only declare a class",
		test: SOURCE,
	},
	{
		id: "server-reactivity-reads-globals",
		program: "runtime",
		file: "src/reactivity/index-server.js",
		anchor: "export const SvelteURL = globalThis.URL;",
		reliesOn:
			"the server's `svelte/reactivity` reads `URL` and `URLSearchParams` from `globalThis`, which the main thread's engine lacks, so the binding gives it its own",
		test: SOURCE,
	},
	{
		id: "reactivity-client-exports",
		program: "runtime",
		file: "src/reactivity/index-client.js",
		anchor: "export { createSubscriber } from './create-subscriber.js';",
		reliesOn:
			"`svelte/reactivity` exports `SvelteDate`, `SvelteSet`, `SvelteMap`, `SvelteURL`, `SvelteURLSearchParams`, `MediaQuery` and `createSubscriber`, which the binding re-exports, replacing `MediaQuery`",
		test: RUNTIME,
	},
	{
		id: "motion-index-media-query",
		program: "runtime",
		file: "src/motion/index.js",
		anchor: "export const prefersReducedMotion = /*@__PURE__*/ new MediaQuery(",
		reliesOn:
			"`svelte/motion` makes a `MediaQuery` when it loads, which calls `matchMedia`, so the binding replaces the module",
		test: SOURCE,
	},
	{
		id: "spring-source",
		program: "runtime",
		file: "src/motion/spring.js",
		anchor: "export class Spring",
		reliesOn: "`Spring` and `spring` live in their own file, which reads no window when it loads",
		test: SOURCE,
	},
	{
		id: "tween-source",
		program: "runtime",
		file: "src/motion/tweened.js",
		anchor: "export class Tween",
		reliesOn: "`Tween` and `tweened` live in their own file, which reads no window when it loads",
		test: SOURCE,
	},
	{
		id: "window-values",
		program: "runtime",
		file: "src/reactivity/window/index.js",
		anchor: "on(window, 'scroll', update)",
		reliesOn:
			"`svelte/reactivity/window` exports ten values, reads `window` as it loads, and so the binding replaces the module with the page's size",
		test: SOURCE,
	},
	{
		id: "attribute-functions-only-as-events",
		program: "runtime",
		file: "src/internal/client/dom/elements/attributes.js",
		anchor: "} else if (typeof value !== 'function') {",
		reliesOn: "`set_attributes` passes a function on only under an `on…` name and drops any other",
		test: SOURCE,
	},
] as const;
