// The messages of the checks of the app's code: code that type-checks and then fails on Lynx. They
// join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";

/** The details each check's message is written from. */
export interface CheckDetails {
	/** `module` is the import that fills `name`; `baseline`, whether the catch-all import does too. */
	fill_not_imported: { name: string; module: string; baseline: boolean };
	/** `instead` says what to use. */
	global_not_in_lynx: { name: string; instead: string };
	/** `instead` says what to use. */
	dom_not_on_lynx: { name: string; instead: string };
	/** `api` as the code reads it: `NativeModules`, `lynx.getJSModule`. */
	background_api_in_main_thread_function: { api: string };
	/** `api` as the code reads it: `__CreateView`, `lynx.querySelector`. */
	main_thread_api_in_background: { api: string };
	/** `selector` as written; `part`, the part of it Lynx doesn't support. */
	css_selector_unsupported: { selector: string; part: string };
	/** `attribute` as written; `branch` names the branch: "`{#if background}`", "the `{:else}` of …". */
	main_thread_handler_in_thread_branch: { attribute: string; branch: string };
}

const THROWS = "so this code throws where it runs";

/** The messages of the checks of the app's code. */
export const CHECK_CATALOGUE: Catalogue<CheckDetails> = {
	fill_not_imported: {
		message: ({ name }) =>
			`Lynx's engine doesn't have the global \`${name}\`, and the app imports nothing that fills it, ${THROWS}.`,
		fix: ({ module, baseline }) =>
			`Import "${module}" in the first line of the app's entry${baseline ? ', or "@sohedra/lynx-polyfill", which holds it too' : ""}.`,
		docs: "fill_not_imported",
	},
	global_not_in_lynx: {
		message: ({ name }) =>
			`Lynx's engine doesn't have the global \`${name}\`, and no fill gives it, ${THROWS}.`,
		fix: ({ instead }) => instead,
		docs: "global_not_in_lynx",
	},
	dom_not_on_lynx: {
		message: ({ name }) =>
			`\`${name}\` is part of the web's DOM, which Lynx doesn't have, ${THROWS}.`,
		fix: ({ instead }) => instead,
		docs: "dom_not_on_lynx",
	},
	background_api_in_main_thread_function: {
		message: ({ api }) =>
			`A main-thread function uses \`${api}\`, which Lynx has on the background thread only.`,
		fix: () =>
			"Use it in a function the main-thread function calls with `runOnBackground`, or in an effect or an event handler.",
		docs: "background_api_in_main_thread_function",
	},
	main_thread_api_in_background: {
		message: ({ api }) =>
			`\`${api}\` is used outside a main-thread function, and Lynx has it on the main thread only.`,
		fix: () =>
			"Reach the element with `main-thread:ref`, and use its methods in a main-thread function: a function whose body starts with 'main thread'.",
		docs: "main_thread_api_in_background",
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
};
