// The build program's messages, one entry for each: the plain sentence, the fix and the docs
// page. `tests/unit/build/diagnostics/catalogue.test.ts` fails for an entry without a fix or a
// page, and snapshots every message.

import type { Catalogue } from "../../wire/index.ts";
import { CHECK_CATALOGUE, MOTION, PAGE_EVENTS, SCREEN_SIZE } from "./catalogue-checks.ts";
import type { CheckDetails } from "./catalogue-checks.ts";
import { LOADER_CATALOGUE } from "./catalogue-loaders.ts";
import type { LoaderDetails } from "./catalogue-loaders.ts";
import { PLUGIN_CATALOGUE } from "./catalogue-plugin.ts";
import type { PluginDetails } from "./catalogue-plugin.ts";
import { SETUP_CATALOGUE } from "./catalogue-setup.ts";
import type { SetupDetails } from "./catalogue-setup.ts";

/** A message that needs nothing to be written. */
type Plain = Record<string, never>;

/** A feature that Svelte refuses under a custom renderer, as Svelte names it ("`{@html}`"). */
interface Refused {
	feature: string;
}

/** Why Lynx's engine refuses a regular expression. */
export type RegExpSyntax = "v_flag" | "d_flag" | "modifier" | "duplicate_group";

/** What each refused syntax is, and how to write the expression without it. */
const REGEXP_SYNTAX: Record<RegExpSyntax, { what: string; instead: string }> = {
	v_flag: {
		what: "the `v` flag",
		instead:
			"Use the `u` flag, and write a class's set operations (`--`, `&&`) out as the characters they leave, or as a lookahead: `(?![a-z])\\p{L}`.",
	},
	d_flag: {
		what: "the `d` flag",
		instead:
			"Leave out the `d` flag, and work out a group's place from `match.index` and the lengths of the groups before it.",
	},
	modifier: {
		what: "a modifier group (`(?i:…)`)",
		instead: "Give the flag to the whole expression, or write the cases out: `[Aa]` for `(?i:a)`.",
	},
	duplicate_group: {
		what: "two groups of the same name",
		instead: "Give each group a name of its own, and read the one that matched.",
	},
};

/** What `syntax` is, and how to write without it; a name it does not know, as it is. */
function syntaxOf(syntax: string): { what: string; instead: string } {
	return (
		REGEXP_SYNTAX[syntax as RegExpSyntax] ?? {
			what: syntax,
			instead: "Write the expression without it.",
		}
	);
}

/** The details each of the build's messages is written from. */
export interface BuildDetails extends SetupDetails, LoaderDetails, PluginDetails, CheckDetails {
	preprocess_failed: { reason: string };
	renderer_option_off: Plain;
	css_injected: Plain;
	bind_directive: { name: string | undefined };
	transition_directive: Refused;
	in_directive: Refused;
	out_directive: Refused;
	animate_directive: Refused;
	on_directive: Refused;
	html_tag: Refused;
	svelte_window: Refused;
	svelte_document: Refused;
	svelte_body: Refused;
	svelte_head: Refused;
	main_thread_function_method: { kind: "class" | "object" };
	main_thread_function_this: { keyword: "this" | "super" };
	main_thread_function_generator: Plain;
	main_thread_function_block_name: { where: string; names: string[] };
	main_thread_function_used_early: { name: string; captures: string[] };
	/** `feature` names the TypeScript ("an `enum`"); `instead`, what to write. */
	main_thread_function_typescript: { feature: string; instead: string };
	/** `version` is the Node.js that builds (`v20.19.0`). */
	typescript_stripper_missing: { version: string };
	plain_function_in_main_thread_function: { name: string };
	/** `written` is the read as written; `name`, the binding's export it reads. */
	shared_import_needed: { written: string; name: string };
	/** `written` is the call as written; `name`, the binding's function it may be. */
	thread_function_unclear: { written: string; name: string };
	script_syntax_error: { reason: string };
	/** `regexp` is the expression as the code has it: a literal, or a `RegExp` call. */
	regexp_refused: { regexp: string; syntax: RegExpSyntax };
	/** `regexp`: a `RegExp` call, as the loaders left it. */
	regexp_refused_call: { regexp: string; syntax: RegExpSyntax };
	event_attribute_renamed: { attribute: string; replacement: string; spelling: string };
	global_event_attribute: { attribute: string; event: string };
	list_item_without_key: Plain;
	/** `test` is the `{#if}`'s test, as written. */
	thread_branch_test: { test: string };
	/** `name` is the name the component declares that the build adds too. */
	thread_branch_name_taken: { name: string };
	/**
	 * `flag` is the thread flag as written: `background`, `env.mainThread`; `read`, the name the markup
	 * reads, the flag itself or a name of the script that depends on it.
	 */
	thread_flag_outside_if: { read: string; flag: string };
	/** `written` says where: "in a spread" or "on <svelte:element>". */
	list_item_defer_ignored: { written: string };
}

/** What a code names: a message the build throws, or one it only warns with. */
export type BuildCode = keyof BuildDetails;

const NOT_AVAILABLE = (feature: string): string => `${feature} is not available in Svelte on Lynx.`;

/** Every message of the build. */
export const BUILD_CATALOGUE: Catalogue<BuildDetails> = {
	...SETUP_CATALOGUE,
	...LOADER_CATALOGUE,
	...PLUGIN_CATALOGUE,
	...CHECK_CATALOGUE,
	preprocess_failed: {
		message: ({ reason }) => `A preprocessor failed on this file.\n${reason}`,
		fix: () => "Fix the error the preprocessor reports, or check its options in svelte.config.js.",
		docs: "preprocess_failed",
	},
	renderer_option_off: {
		message: () =>
			"`<svelte:options customRenderer={null}>` turns the renderer off, and a Lynx page has no DOM to draw without it.",
		fix: () => "Remove the `customRenderer` option.",
		docs: "renderer_option_off",
	},
	css_injected: {
		message: () => NOT_AVAILABLE("`css: 'injected'`"),
		fix: () => "Remove it: the build writes a component's styles to the page's stylesheet.",
		docs: "css_injected",
	},
	bind_directive: {
		message: ({ name }) => NOT_AVAILABLE(name === undefined ? "`bind:`" : `\`bind:${name}\``),
		fix: ({ name }) => {
			if (name === "this") return "Get the element with `{@attach}`.";
			if (name === "value") return "Set `value` and handle the `oninput` event instead.";
			return "Read the value in an event handler, and set it with an attribute.";
		},
		docs: "bind_directive",
	},
	transition_directive: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => MOTION,
		docs: "transition_directive",
	},
	in_directive: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => MOTION,
		docs: "in_directive",
	},
	out_directive: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => MOTION,
		docs: "out_directive",
	},
	animate_directive: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => MOTION,
		docs: "animate_directive",
	},
	on_directive: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => "Write an event attribute instead, such as `ontap={…}`.",
		docs: "on_directive",
	},
	html_tag: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => "Write the elements in the markup: a Lynx page has no HTML to parse.",
		docs: "html_tag",
	},
	svelte_window: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => `${SCREEN_SIZE} ${PAGE_EVENTS}`,
		docs: "svelte_window",
	},
	svelte_document: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => PAGE_EVENTS,
		docs: "svelte_document",
	},
	svelte_body: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => PAGE_EVENTS,
		docs: "svelte_body",
	},
	svelte_head: {
		message: ({ feature }) => NOT_AVAILABLE(feature),
		fix: () => "Remove it: a Lynx page has no head.",
		docs: "svelte_head",
	},
	main_thread_function_method: {
		message: ({ kind }) =>
			`${kind === "class" ? "A class method" : "A method of an object"} cannot be a main-thread function: it would run without its object.`,
		fix: () => "Write a function instead, and pass it what it needs.",
		docs: "main_thread_function_method",
	},
	main_thread_function_this: {
		message: ({ keyword }) => `\`${keyword}\` cannot be used in a main-thread function.`,
		fix: () => "Read what it needs into a variable outside the function.",
		docs: "main_thread_function_this",
	},
	main_thread_function_generator: {
		message: () => "A generator cannot be a main-thread function.",
		fix: () => "Write a function that returns its values, and loop over them where you call it.",
		docs: "main_thread_function_generator",
	},
	main_thread_function_block_name: {
		message: ({ where, names }) =>
			`The main-thread function in \`${where}\` uses ${names.map((name) => `\`${name}\``).join(", ")}, which only exists inside the markup.`,
		fix: () =>
			"Put the value in a `data-*` attribute and read `event.currentTarget.dataset`, or move this markup into a child component.",
		docs: "main_thread_function_block_name",
	},
	main_thread_function_used_early: {
		message: ({ name, captures }) =>
			`The main-thread function \`${name}\` is used above its declaration, where it does not exist yet` +
			(captures.length > 0
				? `: it captures ${captures.map((capture) => `\`${capture}\``).join(", ")}, which is set further down.`
				: "."),
		fix: ({ name }) =>
			`Move the declaration of \`${name}\` above this use, after the values it captures.`,
		docs: "main_thread_function_used_early",
	},
	main_thread_function_typescript: {
		message: ({ feature }) =>
			`A main-thread function cannot use ${feature}: the main thread runs it as JavaScript, with only its types taken out.`,
		fix: ({ instead }) => `Write ${instead} instead.`,
		docs: "main_thread_function_typescript",
	},
	typescript_stripper_missing: {
		message: ({ version }) =>
			`Main-thread functions written in TypeScript need Node.js 22.13 or later to build, which takes their types out; this build runs on Node.js ${version}.`,
		fix: () =>
			"Build with Node.js 22.13 or later, or write this component's main-thread functions without types.",
		docs: "typescript_stripper_missing",
	},
	plain_function_in_main_thread_function: {
		message: ({ name }) =>
			`\`${name}\` is a plain function, and a main-thread function calls it. The main thread cannot run it.`,
		fix: ({ name }) =>
			`Call it through \`runOnBackground(${name})\`, or start its body with 'main thread'.`,
		docs: "plain_function_in_main_thread_function",
	},
	shared_import_needed: {
		message: ({ written, name }) =>
			`A main-thread function uses \`${written}\`${written === name ? "" : `, which is \`${name}\``} of @sohedra/lynx through a plain import, which gives it the background's function: the main thread cannot run it.`,
		fix: ({ name }) =>
			`Import it with \`with { runtime: "shared" }\`, which gives the main thread its own: \`import { ${name} } from "@sohedra/lynx" with { runtime: "shared" }\`.`,
		docs: "shared_import_needed",
	},
	thread_function_unclear: {
		message: ({ written, name }) =>
			`A main-thread function calls \`${written}\`, and the build cannot tell whether it is \`${name}\` of @sohedra/lynx.`,
		fix: ({ name }) =>
			`Import \`${name}\` from "@sohedra/lynx", under any name, or under its own name from a module of the app that re-exports it.`,
		docs: "thread_function_unclear",
	},
	script_syntax_error: {
		message: ({ reason }) => `A script has a syntax error: ${reason}.`,
		fix: () => "Fix the syntax at this place.",
		docs: "script_syntax_error",
	},
	regexp_refused: {
		message: ({ regexp, syntax }) =>
			`The regular expression \`${regexp}\` uses ${syntaxOf(syntax).what}, which Lynx's engine does not have: the thread's whole script would fail to load.`,
		fix: ({ syntax }) => syntaxOf(syntax).instead,
		docs: "regexp_refused",
	},
	regexp_refused_call: {
		message: ({ regexp, syntax }) =>
			`\`${regexp}\` makes a regular expression with ${syntaxOf(syntax).what}, which Lynx's engine does not have: the call throws a SyntaxError where it runs.`,
		fix: ({ syntax }) =>
			`If the code checks for it and catches the error, leave it. Otherwise: ${syntaxOf(syntax).instead}`,
		docs: "regexp_refused_call",
	},
	event_attribute_renamed: {
		message: ({ attribute, spelling }) =>
			`\`${attribute}\` reads as the old \`${spelling}\` spelling of an event attribute, which a component does not write.`,
		fix: ({ replacement }) => `Write \`${replacement}\` instead.`,
		docs: "event_attribute_renamed",
	},
	global_event_attribute: {
		message: ({ attribute }) => `\`${attribute}\` is not an event attribute.`,
		fix: ({ event }) =>
			`Listen with \`on(root, "${event}", handler)\` in an effect, with \`root\` from \`@sohedra/lynx\`.`,
		docs: "global_event_attribute",
	},
	list_item_without_key: {
		message: () => "A `<list-item>` has no key, and Lynx's list needs one to track its cells.",
		fix: () => "Write it directly inside a keyed `{#each}`, or give it an `item-key`.",
		docs: "list_item_without_key",
	},
	thread_branch_test: {
		message: ({ test }) =>
			`\`{#if ${test}}\` holds a component that one thread can render without the other, so the \`$props.id()\` of the components after it may differ between the first frame and the background.`,
		fix: () =>
			"Give the part only one thread renders a block of its own whose test is the flag alone, `{#if background}`, `{#if mainThread}` or `{#if BROWSER}`, and put the rest of the test inside it.",
		docs: "thread_branch_test",
	},
	thread_branch_name_taken: {
		message: ({ name }) =>
			`The name ${name} is one the build adds to this component, to draw a part only one thread renders, and the component declares it too.`,
		fix: ({ name }) => `Rename your ${name}.`,
		docs: "thread_branch_name_taken",
	},
	thread_flag_outside_if: {
		message: ({ read, flag }) =>
			`${read === flag ? `\`${flag}\` is read` : `\`${read}\` depends on \`${flag}\` and is read`} outside an \`{#if}\` test, so the first frame can show something here other than the page shows once it starts.`,
		fix: ({ flag }) =>
			`Put each thread's part in its own branch, \`{#if ${flag}}…{:else}…{/if}\` (or \`{#if ${flag} && user}\`), or read \`${flag}\` in an event handler or an effect.`,
		docs: "thread_flag_outside_if",
	},
	list_item_defer_ignored: {
		message: ({ written }) =>
			`A \`defer\` written ${written} is not read, so the row's contents render with the row.`,
		fix: () => "Write it on the `<list-item>` itself: `<list-item defer>`.",
		docs: "list_item_defer_ignored",
	},
};
