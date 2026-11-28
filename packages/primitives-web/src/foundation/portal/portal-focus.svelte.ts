import { warn } from "@sohedra/primitives-core/foundation/kernel";
import { DEV } from "esm-env";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { HTMLAttributes } from "svelte/elements";
import { on } from "svelte/events";

import { FOCUS_GUARD_TYPE_ATTRIBUTE, focusGuardProps, PORTAL_ATTRIBUTE } from "../focus/index.js";
import {
	attachmentProps,
	attachRef,
	disableFocusInside,
	enableFocusInside,
	getNextTabbable,
	getPreviousTabbable,
	isOutsideEvent,
	isShadowRoot,
	type Props,
} from "../kernel/index.js";
import { PortalContext } from "./portal-context.js";
import { PortalStore } from "./portal-store.svelte.js";

/** Where a portal renders: an element or shadow root; `null` waits; `undefined` is the body. */
export type PortalContainer = HTMLElement | ShadowRoot | null | undefined;

/** A portal's options, as a plain object the part builds from its props. */
export interface PortalOptions {
	/** The container the portal moves its element into. */
	readonly container: PortalContainer;
}

/** A portal that also manages focus across it, for a popup that takes focus. */
export interface FocusPortal {
	/**
	 * The portal element's own props: its marker and, as an attachment inside, the move into the
	 * container.
	 */
	readonly props: Props;
	/** The container the element moves into, once the document is there; `null` while it waits. */
	readonly container: HTMLElement | ShadowRoot | null;
	/** Whether the two guards around the portal element render (an open non-modal popup). */
	readonly guarded: boolean;
	/** Spread on a `<span>` right before the portal element. It holds an attachment. */
	readonly guardBefore: HTMLAttributes<HTMLSpanElement>;
	/** Spread on a `<span>` right after the portal element. It holds an attachment. */
	readonly guardAfter: HTMLAttributes<HTMLSpanElement>;
}

/** `clip-path` hidden, out of the layout, for the `aria-owns` owner span. */
export const ownerVisuallyHidden = "clip-path: inset(50%); position: fixed; top: 0; left: 0";

// Svelte anchors around a block's only node: an empty comment or an empty text node.
function isAnchor(node: Node | null) {
	return (
		node === null ||
		((node.nodeType === 8 || node.nodeType === 3) && (node.textContent ?? "") === "")
	);
}

// The events Svelte delegates (`onclick` and the like on elements): it listens for them on the
// mount target and the document.
const DELEGATED_EVENTS = [
	"beforeinput",
	"click",
	"change",
	"dblclick",
	"contextmenu",
	"focusin",
	"focusout",
	"input",
	"keydown",
	"keyup",
	"mousedown",
	"mousemove",
	"mouseout",
	"mouseover",
	"mouseup",
	"pointerdown",
	"pointermove",
	"pointerout",
	"pointerover",
	"pointerup",
	"touchend",
	"touchmove",
	"touchstart",
];

// Closed shadow roots that hold portals, with how many. Module-level: one set of listeners per
// shadow root, whichever portals of this package share it.
const delegatingRoots = new WeakMap<ShadowRoot, { count: number; off: () => void }>();

/**
 * A closed shadow root hides its event path, so Svelte's delegated handlers on elements portalled
 * into it never run; Svelte's `on` on the root runs them, target to root, in Svelte's order.
 * Returns the release.
 */
function delegateInto(root: ShadowRoot): () => void {
	let entry = delegatingRoots.get(root);
	if (!entry) {
		const offs = DELEGATED_EVENTS.map((type) => on(root, type, () => {}));
		entry = { count: 0, off: () => offs.forEach((off) => off()) };
		delegatingRoots.set(root, entry);
	}
	const current = entry;
	current.count += 1;
	return () => {
		current.count -= 1;
		if (current.count === 0) {
			current.off();
			delegatingRoots.delete(root);
		}
	};
}

/**
 * Moves a part's element into another container while it stays in its component tree. It is the
 * only node of its block, so Svelte's removal of the block removes exactly it; the teardown
 * removes it otherwise (an enclosing block's removal walks only the nodes left in place).
 */
function movePortalNode(
	options: () => PortalOptions,
	portal: PortalStore,
	parent: PortalStore | null,
) {
	// The container, resolved after mount (never on the server).
	let container: HTMLElement | ShadowRoot | null = $state.raw(null);

	const attachPortal: Attachment<HTMLElement> = (node) => {
		const target = untrack(() => container);
		if (!target) {
			return;
		}
		if (DEV && (!isAnchor(node.previousSibling) || !isAnchor(node.nextSibling))) {
			warn(
				"The render snippet of a Portal part must render exactly one root element (the one that",
				"spreads `props`): other nodes beside it would stay behind when it moves to the container.",
			);
		}
		target.appendChild(node);
		const root = node.getRootNode();
		const release = isShadowRoot(root) && root.mode === "closed" ? delegateInto(root) : undefined;
		untrack(() => {
			portal.setPortalNode(node);
		});
		return () => {
			release?.();
			node.remove();
			if (portal.portalNode === node) {
				portal.setPortalNode(null);
			}
		};
	};

	// Resolves the container, which needs the document: after mount.
	$effect(() => {
		const prop = options().container;
		if (prop === null) {
			container = null;
			return;
		}
		container = prop ?? parent?.portalNode ?? document.body;
	});

	return {
		get container() {
			return container;
		},
		props: { [PORTAL_ATTRIBUTE]: "", ...attachmentProps(attachPortal) },
	};
}

/**
 * A portal that manages focus across it: it gives the focus manager its state, keeps a non-modal
 * popup's content out of the tab order until focus enters it, and has that popup's two outside
 * guards. Popups inside portal into its element. Call during the Portal part's init.
 */
export function useFocusPortal(options: () => PortalOptions): FocusPortal {
	const parent = PortalContext.getOr(null);
	const portal = new PortalStore();
	PortalContext.set(portal);
	const moved = movePortalNode(options, portal, parent);

	// Only the flags count, since a trigger change replaces the focus manager's state while the
	// popup stays open.
	const modal = $derived(portal.focusManagerState?.modal === true);
	const open = $derived(portal.focusManagerState?.open === true);
	const guarded = $derived.by(() => {
		const state = portal.focusManagerState;
		return !!state && !state.modal && state.open && !!portal.portalNode;
	});

	// Whether the portal's content is out of the tab order.
	let focusInsideDisabled = false;

	// Inside a non-modal portal, content is tabbable only once focus entered it.
	$effect(() => {
		const node = portal.portalNode;
		if (!node || modal) {
			return;
		}
		const onFocus = (event: FocusEvent) => {
			if (event.relatedTarget && isOutsideEvent(event)) {
				if (event.type === "focusin") {
					if (focusInsideDisabled) {
						enableFocusInside(node);
						focusInsideDisabled = false;
					}
				} else {
					disableFocusInside(node);
					focusInsideDisabled = true;
				}
			}
		};
		const offs = [
			on(node, "focusin", onFocus, { capture: true }),
			on(node, "focusout", onFocus, { capture: true }),
		];
		return () => {
			for (const off of offs) {
				off();
			}
		};
	});

	// Reopening restores tabbability before the focus manager's initial focus.
	$effect(() => {
		const node = portal.portalNode;
		if (!node || !open || !focusInsideDisabled) {
			return;
		}
		untrack(() => {
			enableFocusInside(node);
			focusInsideDisabled = false;
		});
	});

	return {
		get container() {
			return moved.container;
		},
		get guarded() {
			return guarded;
		},
		props: moved.props,
		guardBefore: {
			...focusGuardProps(
				(event) => {
					const node = portal.portalNode;
					if (node && isOutsideEvent(event, node)) {
						portal.guardBeforeInside?.focus();
					} else {
						getPreviousTabbable(portal.focusManagerState?.anchorElement ?? null)?.focus();
					}
				},
				{ [FOCUS_GUARD_TYPE_ATTRIBUTE]: "outside" },
			),
			...attachmentProps(
				attachRef<HTMLElement>((element) => portal.setGuardBeforeOutside(element)),
			),
		},
		guardAfter: {
			...focusGuardProps(
				(event) => {
					const node = portal.portalNode;
					if (node && isOutsideEvent(event, node)) {
						portal.guardAfterInside?.focus();
					} else {
						const state = portal.focusManagerState;
						getNextTabbable(state?.anchorElement ?? null)?.focus();
						state?.onOpenChange(false, event);
					}
				},
				{ [FOCUS_GUARD_TYPE_ATTRIBUTE]: "outside" },
			),
			...attachmentProps(attachRef<HTMLElement>((element) => portal.setGuardAfterOutside(element))),
		},
	};
}
