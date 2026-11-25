// The messages of the checks of the app's code: code that type-checks and then fails on Lynx. They
// join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";

/** The details each check's message is written from. */
export interface CheckDetails {
	/**
	 * `module` is the import that fills `name`; `baseline`, whether the catch-all import does too;
	 * `lacks`, what lacks it where the code runs: "engine" (both threads), "main thread" or
	 * "background thread".
	 */
	fill_not_imported: { name: string; module: string; baseline: boolean; lacks: string };
	/** `instead` says what to use. */
	global_no_fill: { name: string; instead: string };
	/** `instead` says what to use. */
	dom_not_on_lynx: { name: string; instead: string };
	/**
	 * `api` as the code reads it: `NativeModules`, `lynx.getJSModule`; `where`, a main-thread
	 * function, or code outside every function, which the first frame runs on the main thread.
	 */
	background_api_on_main_thread: { api: string; where: "function" | "top_level" };
	/** `api` as the code reads it: `__CreateView`. */
	main_thread_api_in_background: { api: string };
	/** `api` as the code reads it: `lynx.querySelector`. */
	lynx_member_missing: { api: string };
	/** `selector` as written; `part`, the part of it Lynx doesn't support. */
	css_selector_unsupported: { selector: string; part: string };
	/** `attribute` as written; `branch` names the branch: "`{#if background}`", "the `{:else}` of …". */
	main_thread_handler_in_thread_branch: { attribute: string; branch: string };
	svelte_mount_imported: { name: SvelteMountName };
	media_query_imported: Record<string, never>;
	svelte_module_unsupported: { module: UnsupportedSvelteModule };
}

/** Svelte's functions that put a component on the web's DOM. */
export type SvelteMountName = "mount" | "unmount" | "hydrate";

/** Svelte's modules that read the web's `window` as they load. */
export type UnsupportedSvelteModule = "svelte/motion" | "svelte/reactivity/window";

const THROWS = "so this code throws where it runs";

/** What to use for an element's motion, instead of Svelte's. */
export const MOTION =
	"Animate the element with its `animate()` method from an attachment (`{@attach}`), or set its style from a main-thread function with `setStyleProperty()`.";

/** What to use for the screen's and the page's size, instead of the web's. */
export const SCREEN_SIZE =
	"Read the screen's size, which does not change as the page runs, from `systemInfo` in `@sohedra/lynx/host`, and follow the page's size with `on(host, \"onWindowResize\", …)`.";

/** What to use for the web's other events. */
export const PAGE_EVENTS = "Listen to the page's events with `on(root, …)`.";

/** What to use instead of each of Svelte's functions that put a component on the web's DOM. */
export const SVELTE_MOUNT_FIXES: Readonly<Record<SvelteMountName, string>> = {
	mount: 'Import `mount` from "@sohedra/lynx", which mounts a component on the page.',
	unmount:
		'Import `unmount` from "@sohedra/lynx", which unmounts a component its `mount` returned.',
	hydrate:
		'Use `mountPage` from "@sohedra/lynx" in the page\'s entry: it draws the first frame on the main thread and mounts over it.',
};

/** What to use instead of each of Svelte's modules that read the web's `window`. */
export const SVELTE_MODULE_FIXES: Readonly<Record<UnsupportedSvelteModule, string>> = {
	"svelte/motion": MOTION,
	"svelte/reactivity/window": SCREEN_SIZE,
};

/** The messages of the checks of the app's code. */
export const CHECK_CATALOGUE: Catalogue<CheckDetails> = {
	fill_not_imported: {
		message: ({ name, lacks }) =>
			`Lynx's ${lacks} doesn't have the global \`${name}\`, and the app imports nothing that fills it, ${THROWS}.`,
		fix: ({ module, baseline }) =>
			`Import "${module}" in the first line of the app's entry${baseline ? ', or "@sohedra/lynx-polyfill", which holds it too' : ""}.`,
		docs: "fill_not_imported",
	},
	global_no_fill: {
		message: ({ name }) =>
			`Lynx's engine doesn't have the global \`${name}\`, and no fill gives it, ${THROWS}.`,
		fix: ({ instead }) => instead,
		docs: "global_no_fill",
	},
	dom_not_on_lynx: {
		message: ({ name }) =>
			`\`${name}\` is part of the web's DOM, which Lynx doesn't have, ${THROWS}.`,
		fix: ({ instead }) => instead,
		docs: "dom_not_on_lynx",
	},
	background_api_on_main_thread: {
		message: ({ api, where }) =>
			where === "function"
				? `A main-thread function uses \`${api}\`, which Lynx has on the background thread only.`
				: `\`${api}\` is read outside every function, which the main thread runs too for the first frame, and Lynx has it on the background thread only.`,
		fix: ({ where }) =>
			where === "function"
				? "Use it in a function the main-thread function calls with `runOnBackground`, or in an effect or an event handler."
				: "Read it in an effect or an event handler, which run on the background, or under `if (background)`.",
		docs: "background_api_on_main_thread",
	},
	main_thread_api_in_background: {
		message: ({ api }) =>
			`\`${api}\` is used outside a main-thread function, and Lynx has it on the main thread only.`,
		fix: () =>
			"Reach the element with `main-thread:ref`, and use its methods in a main-thread function: a function whose body starts with 'main thread'.",
		docs: "main_thread_api_in_background",
	},
	lynx_member_missing: {
		message: ({ api }) => `\`${api}\` doesn't exist on either thread in Svelte on Lynx, ${THROWS}.`,
		fix: () =>
			"Reach the element with `main-thread:ref` in a main-thread function, and call the element's own method.",
		docs: "lynx_member_missing",
	},
	css_selector_unsupported: {
		message: ({ selector, part }) =>
			`The selector \`${selector}\` uses ${part}, which is not among the selectors Lynx supports, so the rule may never apply.`,
		fix: () =>
			"Select the element by its type, a class or an id, and set the class from the component's state.",
		docs: "css_selector_unsupported",
	},
	main_thread_handler_in_thread_branch: {
		message: ({ attribute, branch }) =>
			`\`${attribute}\` is inside ${branch}, which only one thread draws, so a call of \`runOnBackground\` it makes before the background takes the page over gets no answer.`,
		fix: () =>
			"Set it on an element the background renders the same way as the first frame, outside the `{#if}`.",
		docs: "main_thread_handler_in_thread_branch",
	},
	svelte_mount_imported: {
		message: ({ name }) =>
			`\`${name}\` is imported from "svelte", whose \`${name}\` works with the web's DOM, not with Lynx's page.`,
		fix: ({ name }) => SVELTE_MOUNT_FIXES[name],
		docs: "svelte_mount_imported",
	},
	media_query_imported: {
		message: () =>
			"`MediaQuery` is imported from \"svelte/reactivity\", whose `MediaQuery` calls the web's `matchMedia`, which Lynx doesn't have, so making one throws.",
		fix: () => `${SCREEN_SIZE} For the color scheme, read the host's theme from \`globalProps\`.`,
		docs: "media_query_imported",
	},
	svelte_module_unsupported: {
		message: ({ module }) =>
			`\`${module}\` is not supported in Svelte on Lynx yet: it reads the web's \`window\` as it loads, which Lynx doesn't have, so the background throws as it loads it.`,
		fix: ({ module }) => SVELTE_MODULE_FIXES[module],
		docs: "svelte_module_unsupported",
	},
};
