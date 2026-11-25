// The background's messages, one entry for each: the plain sentence, the fix and the docs page.
// `tests/unit/background/catalogue.test.ts` fails for an entry without a fix or a page, and
// snapshots every message.

import { catalogueError } from "../wire/index.ts";
import type { Catalogue } from "../wire/index.ts";

/** The details each of the background's messages is written from. */
export interface BackgroundDetails {
	/** `call` names what was asked of the main thread. */
	page_is_gone: { call: string };
	/** `where` is the component's `file:line:col`, when Svelte's development build gives it. */
	text_outside_text: { text: string; parent: string; where?: string | undefined };
	list_item_key_object: { where?: string | undefined };
	/** `limit` is how many elements; `where` the scroll view's `file:line:col`, in development builds. */
	scroll_view_many_children: { limit: number; where?: string | undefined };
	input_value_not_written: { tag: string; reason: string };
	/** `name` is the attribute's. */
	attribute_not_copyable: { name: string; tag: string; reason: string };
	/** `method` is the element method the developer called. */
	/** `where` is the element's `file:line:col`, in development builds. */
	element_not_on_page: { method: string; tag: string; where?: string | undefined };
	element_not_shown: { method: string; tag: string; where?: string | undefined };
	/** `name` is the animation's, when the app named it. */
	animation_canceled: { tag: string; name?: string | undefined };
	/**
	 * `difference` says what differs, in development builds only; `where` is the element's
	 * `file:line:col` there.
	 */
	hydration_mismatch: { difference?: string | undefined; where?: string | undefined };
	/**
	 * `name` is the attribute's; `expected` its value on the background and `got` in the first
	 * frame; `where` the element's `file:line:col`.
	 */
	props_id_mismatch: {
		tag: string;
		name: string;
		expected: string;
		got: string;
		where?: string | undefined;
	};
	/** `where` is the row's `file:line:col`, in development builds. */
	list_item_defer_needs_async_list: { where?: string | undefined };
	/** `index` is the list's `initial-scroll-index`; `where` the list's `file:line:col`. */
	initial_scroll_index_past_initial_rows: {
		index: number;
		cap: number;
		where?: string | undefined;
	};
	/** `value` is the list's `initial-item-count`, as written; `where` the list's `file:line:col`. */
	initial_item_count_not_a_count: { value: string; where?: string | undefined };
	/** `name` is the function's name, or what the value is. */
	not_a_main_thread_function: { name: string };
	/** `name` is the function's name, or what the value is. */
	run_on_background_outside_main_thread: { name: string };
	main_thread_ref_read_on_background: Record<string, never>;
	main_thread_ref_set_on_background: Record<string, never>;
	background_function_missing: Record<string, never>;
	/** `name` is the attribute's; `where` the element's `file:line:col`, in development builds. */
	plain_function_under_main_thread: { name: string; tag: string; where?: string | undefined };
	/** `value` says what was given: the text, the number, an object. */
	main_thread_ref_not_a_ref: { value: string; tag: string; where?: string | undefined };
	/** `value` says what was given: a function, a list, an object. */
	main_thread_gesture_not_a_gesture: { value: string; tag: string; where?: string | undefined };
	/**
	 * `attribute` is the one the function is bound to and `owner` its element's tag, when it is bound
	 * to one; `name` the captured value as written and `where` the function's `file:line:col`, in
	 * development builds; `depth` how deep a copy goes.
	 */
	capture_too_deep: {
		attribute?: string | undefined;
		owner?: string | undefined;
		name?: string | undefined;
		depth: number;
		where?: string | undefined;
	};
	/**
	 * `tag` is the captured element's; `attribute` the one the function is bound to and `owner` its
	 * element's tag, when it is bound to one; `name` the captured value as written and `where` the
	 * function's `file:line:col`, in development builds.
	 */
	element_in_main_thread_function: {
		tag: string;
		attribute?: string | undefined;
		owner?: string | undefined;
		name?: string | undefined;
		where?: string | undefined;
	};
	/** `name` is the attribute as written, `replacement` what to write instead. */
	main_thread_event_spelling_removed: {
		name: string;
		replacement: string;
		tag: string;
		where?: string | undefined;
	};
	mount_without_page: Record<string, never>;
	/** `what` is the argument: `container`, `source` or `source[1]`. */
	static_copy_not_on_page: { what: string };
	/** `tag` is the container's. */
	static_copy_container_not_empty: { tag: string };
	static_copy_list: Record<string, never>;
	static_copy_page_root: Record<string, never>;
	/** `url` is the bundle's; `code` and `reason` what Lynx answered. */
	lazy_bundle_not_loaded: { url: string; code: number; reason?: string | undefined };
	/** `seconds` is how long it waited. */
	lazy_bundle_timed_out: { url: string; seconds: number };
	/** `url` is the bundle's address as the build wrote it. */
	lazy_bundle_address_not_full: { url: string };
	/** `where` is the build's errors, as the dev server sent them. */
	build_failed: { where: string };
	reload_needs_devtool: Record<string, never>;
}

/** What a code of the background names. */
export type BackgroundCode = keyof BackgroundDetails;

/** A main-thread function, named by the attribute it is bound to, when it is bound to one. */
function mainThreadFunction({
	attribute,
	owner,
}: {
	attribute?: string | undefined;
	owner?: string | undefined;
}): string {
	return attribute === undefined
		? "A main-thread function"
		: `The main-thread function of ${attribute} on <${owner ?? "element"}>`;
}

/**
 * The codes only a development build reports. Only code a production build drops reaches their
 * entries, which are kept apart, so it drops their text too.
 */
export type BackgroundDevelopmentCode =
	| "text_outside_text"
	| "list_item_key_object"
	| "scroll_view_many_children"
	| "props_id_mismatch"
	| "initial_scroll_index_past_initial_rows"
	| "initial_item_count_not_a_count"
	| "main_thread_ref_read_on_background"
	| "main_thread_gesture_not_a_gesture"
	| "plain_function_under_main_thread"
	| "main_thread_event_spelling_removed"
	| "build_failed"
	| "reload_needs_devtool";

/** Every message of the background that a production build reports. */
export const BACKGROUND_CATALOGUE: Catalogue<Omit<BackgroundDetails, BackgroundDevelopmentCode>> = {
	page_is_gone: {
		message: ({ call }) =>
			`A call of ${call} has no answer: the page it was made on has been closed or reloaded.`,
		fix: () =>
			"Nothing to fix when the page closed on purpose. Otherwise, make the call again on the page that is open now.",
		docs: "page_is_gone",
	},
	input_value_not_written: {
		message: ({ tag, reason }) =>
			`The value of the <${tag}> element could not be written: ${reason.split("\n")[0]!.trim()}`,
		fix: () =>
			"Check that the element is still on the page when its value changes, and that it is an <input> or a <textarea>.",
		docs: "input_value_not_written",
	},
	attribute_not_copyable: {
		message: ({ name, tag, reason }) =>
			`The value of ${name} on <${tag}> cannot be sent to the main thread (${reason.split("\n")[0]!.trim()}), so the element does not get it.`,
		fix: () =>
			"Give the attribute plain data: strings, numbers, booleans, null, arrays and plain objects, without cycles or BigInt values.",
		docs: "attribute_not_copyable",
	},
	element_not_on_page: {
		message: ({ method, tag }) =>
			`The <${tag}> is not on the page, so its ${method} cannot run: Lynx has no element for it.`,
		fix: ({ method }) =>
			`Call ${method} once the element is on the page: in an attachment, an effect or an event handler, not while the component is being built or after the element was removed.`,
		docs: "element_not_on_page",
	},
	element_not_shown: {
		message: ({ method, tag }) =>
			`The <${tag}> is in a list row Lynx is not showing, so its ${method} cannot run: Lynx makes a row's elements only while it shows the row.`,
		fix: ({ method }) =>
			`Call ${method} while Lynx shows the row, for example from the row's layoutchange event.`,
		docs: "element_not_shown",
	},
	animation_canceled: {
		message: ({ tag, name }) =>
			`The animation ${name === undefined ? "" : `${name} `}of the <${tag}> was canceled before it finished.`,
		fix: () =>
			"Nothing to fix when the animation was canceled on purpose. Catch the rejection of finished where a canceled animation matters.",
		docs: "animation_canceled",
	},
	hydration_mismatch: {
		message: ({ difference }) =>
			difference === undefined
				? "The first frame did not match the page the background rendered, so the page was made again."
				: `The first frame did not match the page the background rendered: ${difference}. The page was made again.`,
		fix: () =>
			"Render the same markup on both threads from the page's data. Keep what only the background knows (a value an effect sets, the time, a random number) in an effect, or in {#if background} from @sohedra/lynx/environment.",
		docs: "hydration_mismatch",
	},
	list_item_defer_needs_async_list: {
		message: () =>
			'A <list-item defer> is in a <list> without custom-list-name="list-container", so its row renders now instead of waiting until Lynx asks for it.',
		fix: () =>
			'Give the list custom-list-name="list-container", the list that waits for a row Lynx asked for. Or remove defer.',
		docs: "list_item_defer_needs_async_list",
	},
	not_a_main_thread_function: {
		message: ({ name }) =>
			`The value given to runOnMainThread, ${name}, is not a main-thread function, so nothing runs on the main thread.`,
		fix: () =>
			"Start the function's body with the 'main thread' directive, and pass the function itself: runOnMainThread(fn)(...args).",
		docs: "not_a_main_thread_function",
	},
	run_on_background_outside_main_thread: {
		message: ({ name }) =>
			`A call of runOnBackground(${name}) ran on the background: it calls a background function from a main-thread function only.`,
		fix: () =>
			"On the background, call the function itself. Use runOnBackground inside a function whose body starts with 'main thread'.",
		docs: "run_on_background_outside_main_thread",
	},
	main_thread_ref_set_on_background: {
		message: () =>
			"The current value of a main-thread ref was set on the background: the ref's value lives on the main thread, and only main-thread functions set it.",
		fix: () =>
			"Set it inside a main-thread function, and call that from the background with runOnMainThread(set)(value).",
		docs: "main_thread_ref_set_on_background",
	},
	background_function_missing: {
		message: () =>
			"A main-thread function called a background function through runOnBackground, and the background no longer has it: the page let go of the main-thread function that named it.",
		fix: () =>
			"Keep main-thread functions that call the background in an attribute, a ref or a call that is still on the page. If the page was made again after its first frame could not be hydrated, functions kept from before cannot call the background.",
		docs: "background_function_missing",
	},
	main_thread_ref_not_a_ref: {
		message: ({ value, tag }) =>
			`The <${tag}>'s main-thread:ref is ${value}, which is neither a ref nor a main-thread function, so the main thread binds nothing.`,
		fix: () =>
			"Give it a ref made with mainThreadRef() from @sohedra/lynx, or a main-thread function that takes the element.",
		docs: "main_thread_ref_not_a_ref",
	},
	capture_too_deep: {
		message: (details) =>
			`${mainThreadFunction(details)} captures ${details.name ?? "a value"}, which holds itself or is nested more than ${details.depth} levels deep, so it cannot be sent to the main thread.`,
		fix: ({ name }) =>
			`Read only the members the function needs, such as ${name ?? "value"}.id, so that it captures those alone.`,
		docs: "capture_too_deep",
	},
	element_in_main_thread_function: {
		message: (details) =>
			`${mainThreadFunction(details)} captures ${details.name === undefined ? "" : `${details.name}, which holds `}the <${details.tag}> element of the background, and an element cannot be sent to the main thread.`,
		fix: () =>
			"Give the element main-thread:ref={ref}, with const ref = mainThreadRef() from @sohedra/lynx, and capture ref instead: the function reads the element as ref.current.",
		docs: "element_in_main_thread_function",
	},
	mount_without_page: {
		message: () =>
			"A call of mount ran with no page running: before mountPage started the page, or after the page closed.",
		fix: () =>
			"Call mount once mountPage has started the page: from $effect, an attachment or an event handler.",
		docs: "mount_without_page",
	},
	static_copy_not_on_page: {
		message: ({ what }) => `The ${what} given to createStaticCopy is not an element on the page.`,
		fix: () =>
			"Pass an element Svelte rendered while it is on the page, such as the node an attachment gets.",
		docs: "static_copy_not_on_page",
	},
	static_copy_container_not_empty: {
		message: ({ tag }) =>
			`The <${tag}> given to createStaticCopy as the container holds something that is not a copy.`,
		fix: () =>
			"Give the copies an element of their own that Svelte renders with no children: Svelte never looks inside it.",
		docs: "static_copy_container_not_empty",
	},
	static_copy_list: {
		message: () =>
			"The source given to createStaticCopy holds a <list>, and a <list> cannot be copied.",
		fix: () => "Copy the elements around the list, or the contents of its rows, instead.",
		docs: "static_copy_list",
	},
	static_copy_page_root: {
		message: () =>
			"The page's root was given to createStaticCopy as a source, and the page itself cannot be copied.",
		fix: () =>
			"Copy the element that holds the page's content instead, such as the top element of the page's root component.",
		docs: "static_copy_page_root",
	},
	lazy_bundle_not_loaded: {
		message: ({ url, code, reason }) =>
			`The lazy bundle ${url} did not load: Lynx answered with the code ${code}${reason ? ` (${reason})` : ""}.`,
		fix: () =>
			"Check that the bundle is served at that address and that the device reaches it: Lynx's own report of the failure says why it failed.",
		docs: "lazy_bundle_not_loaded",
	},
	lazy_bundle_timed_out: {
		message: ({ url, seconds }) => `The lazy bundle ${url} did not load within ${seconds} seconds.`,
		fix: () => "Check that the bundle is served at that address and that the device reaches it.",
		docs: "lazy_bundle_timed_out",
	},
	lazy_bundle_address_not_full: {
		message: ({ url }) =>
			`The lazy bundle ${url} has no full address, and the page's own address, to resolve it against, is unknown.`,
		fix: () => "Set output.assetPrefix to the full address the bundles are served from.",
		docs: "lazy_bundle_address_not_full",
	},
};

/** The messages of the background that only a development build reports. */
export const BACKGROUND_DEVELOPMENT_CATALOGUE: Catalogue<
	Pick<BackgroundDetails, BackgroundDevelopmentCode>
> = {
	text_outside_text: {
		message: ({ text, parent }) =>
			`The text "${text}" is inside <${parent}>, and Lynx shows text only inside <text>.`,
		fix: ({ text }) => `Wrap it in <text>: <text>${text}</text>.`,
		docs: "text_outside_text",
	},
	scroll_view_many_children: {
		message: ({ limit }) =>
			`A <scroll-view> holds more than ${limit} elements directly, and it draws every one of them at once, which slows the page's first paint and every update.`,
		fix: () =>
			"Show the rows in a <list> of <list-item> elements instead: Lynx makes a list's rows as they scroll into view.",
		docs: "scroll_view_many_children",
	},
	list_item_key_object: {
		message: () =>
			"A <list-item> has an object as its item-key, and Lynx reads an item-key as text.",
		fix: () =>
			"Key the item with a string or a number that names it, such as its id: {#each items as item (item.id)}, or item-key={item.id}.",
		docs: "list_item_key_object",
	},
	props_id_mismatch: {
		message: ({ tag, name, expected, got }) =>
			`The <${tag}>'s ${name} is "${got}" in the first frame and "${expected}" on the background: $props.id() gave another id on each thread, and the first frame showed its own until the background's replaced it.`,
		fix: () =>
			"Look before it for a component that only one thread renders, and put it inside {#if background} or {#if mainThread} from @sohedra/lynx/environment, or {#if BROWSER} from esm-env, with the flag alone as the test. Or look for a component binding whose child changes the bound value as it starts, which renders the first frame twice: give the value its start in the parent.",
		docs: "props_id_mismatch",
	},
	initial_scroll_index_past_initial_rows: {
		message: ({ index, cap }) =>
			`A <list> starts at initial-scroll-index ${index}, more than ${cap} rows down, so its first frame draws only its first rows, and the deferred rows it starts at are empty until the background renders them.`,
		fix: ({ cap }) =>
			`Start the list at most ${cap} rows down, or take defer off the rows it starts at.`,
		docs: "initial_scroll_index_past_initial_rows",
	},
	initial_item_count_not_a_count: {
		message: ({ value }) =>
			`A <list>'s initial-item-count is ${value}, which is not a number of rows, so its first frame draws as many rows as it would without it.`,
		fix: () =>
			'Give initial-item-count a whole number of rows, 0 or more: initial-item-count={5} or initial-item-count="5".',
		docs: "initial_item_count_not_a_count",
	},
	main_thread_ref_read_on_background: {
		message: () =>
			"The current value of a main-thread ref was read on the background, where it is only the ref's initial value: the ref's value lives on the main thread.",
		fix: () =>
			"Read it inside a main-thread function. To get it on the background, return it from one: await runOnMainThread(read)().",
		docs: "main_thread_ref_read_on_background",
	},
	plain_function_under_main_thread: {
		message: ({ name, tag }) =>
			`The <${tag}>'s ${name} is a plain function, so the main thread binds nothing: a main-thread attribute takes a main-thread function.`,
		fix: () =>
			"Start the function's body with the 'main thread' directive, or use the attribute without the main-thread: prefix to run it on the background.",
		docs: "plain_function_under_main_thread",
	},
	main_thread_gesture_not_a_gesture: {
		message: ({ value, tag }) =>
			`The <${tag}>'s main-thread:gesture is ${value}, not a gesture, so the main thread sets no gesture on it.`,
		fix: () =>
			"Give it a gesture made with new, such as new PanGesture({ onUpdate }) from @sohedra/lynx/gesture. Several gestures on one element go in one composition, such as RaceGesture from @sohedra/lynx/experimental.",
		docs: "main_thread_gesture_not_a_gesture",
	},
	main_thread_event_spelling_removed: {
		message: ({ name, tag }) =>
			`The <${tag}>'s ${name} uses Lynx's own spelling of an event, which a component no longer writes.`,
		fix: ({ replacement }) => `Write ${replacement} instead.`,
		docs: "main_thread_event_spelling_removed",
	},
	build_failed: {
		message: () => "The app's last change did not build, so the page still runs the app as it was.",
		fix: () => "Fix the error the terminal shows too: the page updates once the app builds.",
		docs: "build_failed",
	},
	reload_needs_devtool: {
		message: () =>
			"A change needs the page to load again, and only Lynx's DevTool loads it from the dev server: DevTool is off.",
		fix: () =>
			"Reopen the page to see the change: until then, later changes do not show either. To have the page load again by itself, turn DevTool on in the host's settings (in Lynx Explorer, its DevTool switch).",
		docs: "reload_needs_devtool",
	},
};

/** One message of the background: its code and the details it is written from. */
export interface BackgroundReport<Code extends BackgroundCode> {
	code: Code;
	details: BackgroundDetails[Code];
}

/** An error of the background: its text is the message, and `code` the message's stable code. */
export type BackgroundError = Error & { code: BackgroundCode };

/** The error for a message of the background that a production build reports. */
export function backgroundError<Code extends Exclude<BackgroundCode, BackgroundDevelopmentCode>>(
	report: BackgroundReport<Code>,
): BackgroundError {
	return catalogueError(BACKGROUND_CATALOGUE, report);
}

/**
 * The error for a message only a development build reports, for code a production build drops:
 * elsewhere, its entries would ship.
 */
export function backgroundDevelopmentError<Code extends BackgroundDevelopmentCode>(
	report: BackgroundReport<Code>,
): BackgroundError {
	return catalogueError(BACKGROUND_DEVELOPMENT_CATALOGUE, report);
}
