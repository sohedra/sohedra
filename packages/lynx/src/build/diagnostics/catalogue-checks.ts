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
	/** `name` is `mount` or `unmount`. */
	svelte_mount_imported: { name: string };
}

const THROWS = "so this code throws where it runs";

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
		fix: ({ name }) =>
			`Import \`${name}\` from "@sohedra/lynx", which ${name === "mount" ? "mounts a component on the page" : "unmounts a component its `mount` returned"}.`,
		docs: "svelte_mount_imported",
	},
};
