// The messages of the loaders: the files they read, and what they patch in Svelte's own text.
// They join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";

/** The details each loader message is written from. */
export interface LoaderDetails {
	css_not_stored: { file: string };
	hot_footer_missing: { file: string };
	spread_setter_moved: { file: string; anchor: string };
	primjs_regex_moved: { file: string; name: string };
	/** `anchor` is the function's first line, when the file is there and the function is not. */
	dev_client_moved: { file: string; anchor?: string | undefined };
	background_only_in_component: { file?: string };
	background_only_reexport_all: { file: string; from: string };
	background_only_used: { used: string; file: string };
}

/** The messages of the loaders. */
export const LOADER_CATALOGUE: Catalogue<LoaderDetails> = {
	css_not_stored: {
		message: ({ file }) =>
			`The styles of ${file} were not found: its code came from a build cache that has none for it.`,
		fix: () => "Delete node_modules/.cache and build again.",
		docs: "css_not_stored",
	},
	hot_footer_missing: {
		message: ({ file }) =>
			`Svelte's hot-reload code is not where the build expected it in ${file}, so a change to this component reloads the page.`,
		fix: () => "Update @sohedra/lynx, or turn hot reload off with `dev: { hmr: false }`.",
		docs: "hot_footer_missing",
	},
	spread_setter_moved: {
		message: ({ file, anchor }) =>
			`Svelte's props code has changed, so the build cannot make bindings work beside a spread: ${anchor} is not in ${file} exactly once.`,
		fix: () => "Use the Svelte version this @sohedra/lynx was built for, or update @sohedra/lynx.",
		docs: "spread_setter_moved",
	},
	dev_client_moved: {
		message: ({ file, anchor }) => {
			const lost = file.endsWith("reloadApp.js")
				? "a change that needs DevTool to load the page says nothing while DevTool is off"
				: "build errors stay out of LogBox";
			return anchor === undefined
				? `Lynx's dev client has changed: ${file} is not in the build, so ${lost}.`
				: `Lynx's dev client has changed: \`${anchor}\` is not in ${file} exactly once, so ${lost}.`;
		},
		fix: () =>
			"Use the @lynx-js/webpack-dev-transport this @sohedra/lynx was built for, or update @sohedra/lynx.",
		docs: "dev_client_moved",
	},
	primjs_regex_moved: {
		message: ({ file, name }) =>
			`Svelte's \`${name}\` is not where the build expected it in ${file}, so Lynx's main-thread engine may refuse the file.`,
		fix: () => "Use the Svelte version this @sohedra/lynx was built for, or update @sohedra/lynx.",
		docs: "primjs_regex_moved",
	},
	background_only_in_component: {
		message: ({ file }) =>
			`${file === undefined ? "A Svelte component" : `The component ${file}`} imports 'background-only', but every component also renders on the main thread for the first frame.`,
		fix: () =>
			"Keep the background-only code in a .ts module, or keep the component out of the first frame with a `<svelte:boundary>` that has a `pending` snippet.",
		docs: "background_only_in_component",
	},
	background_only_reexport_all: {
		message: ({ file, from }) =>
			`The module ${file} imports 'background-only' and has \`export * from '${from}'\`: the main thread replaces the module with a stub, and needs its export names.`,
		fix: ({ from }) => `Name them: \`export { a, b } from '${from}'\`.`,
		docs: "background_only_reexport_all",
	},
	background_only_used: {
		message: ({ used, file }) =>
			`The first frame used \`${used}\`, from the background-only module ${file}.`,
		fix: () =>
			"The main thread draws the first frame and has no copy of it: use it in onMount, $effect or an event handler. The background thread draws this page instead.",
		docs: "background_only_used",
	},
};
