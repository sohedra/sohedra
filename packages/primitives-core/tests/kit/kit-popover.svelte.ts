// A PopoverStore as Popover.Root builds it, on the fake platform: for the tests of Popover and of
// the popup, hover and position jobs it runs.
import { flushSync } from "svelte";

import { PopoverStore, type PopoverStoreProps } from "../../src/components/popover/index.js";
import { bound, type PlatformTypes } from "../../src/foundation/kernel/index.js";
import { FloatingTree } from "../../src/foundation/popup/index.js";
import { root } from "./kit-effects.svelte.js";
import { createFakePlatform } from "./kit-fake-platform.js";

type Props = PopoverStoreProps<unknown, PlatformTypes> & { open: boolean | undefined };

/** Popover.Root's props as `$state`, the way the component exposes them, with the binding. */
export type PopoverProps = { -readonly [K in keyof Props]: Props[K] };

export interface PopoverOptions {
	/**
	 * Asked at each write to the bound `open`: false leaves `open` as the app set it, the way an app
	 * that ignores the popover's request does. Without it every write lands.
	 */
	accepts?: () => boolean;
	/** False leaves the store unconnected; by default it connects in an effect root, as the Root does. */
	connect?: boolean;
}

/**
 * A PopoverStore over `$state` props with `open` bound to them, on a fake platform and a tree of
 * its own. `disconnect` tears down what `connect()` set up; it also runs when the test finishes.
 */
export function createPopover(initial: Partial<PopoverProps> = {}, options: PopoverOptions = {}) {
	const props = $state<PopoverProps>({
		open: undefined,
		defaultOpen: undefined,
		triggerId: undefined,
		defaultTriggerId: undefined,
		onOpenChange: undefined,
		onOpenChangeComplete: undefined,
		modal: undefined,
		...initial,
	});
	const platform = createFakePlatform();
	const tree = new FloatingTree();
	const store = new PopoverStore(() => props, {
		open: bound(
			() => props.open,
			(next) => {
				if (options.accepts?.() !== false) {
					props.open = next;
				}
			},
		),
		floatingId: "popup",
		tree,
		nested: false,
		platform,
	});
	const disconnect = options.connect === false ? () => {} : root(() => store.connect());
	flushSync();
	return { props, store, tree, scheduler: platform.scheduler, disconnect };
}
