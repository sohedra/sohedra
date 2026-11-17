// The messages of setting the build up: the plugin's options, the engine it runs on and the
// Svelte it compiles with. They join the build's catalogue.

import type { Catalogue } from "../../wire/index.ts";
import { PLUGIN_OPTION_NAMES } from "../plugin/option-names.ts";

/** The details each setup message is written from. */
export interface SetupDetails {
	unknown_plugin_option: { name: string; suggestion?: string | undefined };
	plugin_option_removed: { name: string; instead: string };
	plugin_option_type: { name: string; expected: string; given: string };
	single_copy_name: { given: string };
	engine_version_old: { version: string; minimum: string };
	engine_version_new: { version: string; maximum: string };
	define_thread_unknown: { name: string };
	define_key_reserved: { name: string };
	define_key_invalid: { name: string };
	page_config_reserved: { key: string };
	first_frame_not_boolean: { entry: string; given: string };
}

const OPTIONS = "`pluginSvelteLynx()`";
const LIST = PLUGIN_OPTION_NAMES.map((name) => `\`${name}\``);

/** The messages of setup. */
export const SETUP_CATALOGUE: Catalogue<SetupDetails> = {
	unknown_plugin_option: {
		message: ({ name }) => `\`${name}\` is not an option of ${OPTIONS}.`,
		fix: ({ suggestion }) =>
			suggestion === undefined
				? `The options are ${LIST.slice(0, -1).join(", ")} and ${LIST.at(-1)}.`
				: `Did you mean \`${suggestion}\`?`,
		docs: "unknown_plugin_option",
	},
	plugin_option_removed: {
		message: ({ name }) => `\`${name}\` is not an option of ${OPTIONS} any more.`,
		fix: ({ instead }) => instead,
		docs: "plugin_option_removed",
	},
	plugin_option_type: {
		message: ({ name, expected, given }) => `\`${name}\` must be ${expected}; got ${given}.`,
		fix: ({ name, expected }) => `Set \`${name}\` to ${expected}, or leave it out.`,
		docs: "plugin_option_type",
	},
	single_copy_name: {
		message: ({ given }) =>
			`\`singleCopy\` must be a list of package names such as 'zustand' or '@acme/state'; got ${given}.`,
		fix: () => "Write the package's name, not a path into it or a file.",
		docs: "single_copy_name",
	},
	engine_version_old: {
		message: ({ version, minimum }) =>
			`\`engineVersion\` is '${version}', and the binding builds for Lynx ${minimum} and later.`,
		fix: ({ minimum }) => `Use '${minimum}' or later, or leave the option out for '${minimum}'.`,
		docs: "engine_version_old",
	},
	engine_version_new: {
		message: ({ version, maximum }) =>
			`\`engineVersion\` is '${version}', and the binding's encoder encodes for Lynx ${maximum} at most.`,
		fix: ({ maximum }) => `Use '${maximum}' or earlier, or update the binding.`,
		docs: "engine_version_new",
	},
	define_thread_unknown: {
		message: ({ name }) => `\`${name}\` is not a thread.`,
		fix: () => "Use `define.mainThread` or `define.background`.",
		docs: "define_thread_unknown",
	},
	define_key_reserved: {
		message: ({ name }) => `\`${name}\` is set by the plugin.`,
		fix: () => "Remove it from `define`.",
		docs: "define_key_reserved",
	},
	define_key_invalid: {
		message: ({ name }) => `\`${name}\` is not a plain identifier.`,
		fix: () =>
			"Use a name such as `__API__`: `define` replaces a global name, not an expression like `process.env.API`.",
		docs: "define_key_invalid",
	},
	page_config_reserved: {
		message: ({ key }) => `\`pageConfig.${key}\` is set by the plugin.`,
		fix: ({ key }) =>
			key === "targetSdkVersion"
				? "Set the engine version with the `engineVersion` option."
				: "Remove it from `pageConfig`.",
		docs: "page_config_reserved",
	},
	first_frame_not_boolean: {
		message: ({ entry, given }) =>
			`\`firstFrame\` returned ${given} for the entry \`${entry}\`, and it must return a boolean.`,
		fix: () => "Return `true` or `false` from the function.",
		docs: "first_frame_not_boolean",
	},
};
