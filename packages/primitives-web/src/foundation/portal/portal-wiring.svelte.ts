import { warn } from "@sohedra/primitives-core/foundation/kernel/index.js";
import { DEV } from "esm-env";
import { untrack } from "svelte";
import { type Attachment, createAttachmentKey } from "svelte/attachments";
import type { HTMLAttributes } from "svelte/elements";
import { on } from "svelte/events";

import { focusGuardProps, PORTAL_ATTRIBUTE } from "../focus/index.js";
import {
	attachRef,
	disableFocusInside,
	enableFocusInside,
	getNextTabbable,
	getPreviousTabbable,
	isOutsideEvent,
	isShadowRoot,
} from "../kernel/index.js";
import { FloatingPortalContext, FloatingPortalState } from "./portal-context.svelte.js";

/** Where a portal renders: an element or shadow root; `null` waits; `undefined` is the body. */
export type PortalContainer = HTMLElement | ShadowRoot | null | undefined;

/** A portal's options, as a plain object the part builds from its props. */
export interface PortalOptions {
	readonly container: PortalContainer;
}

/** A portal that only moves its element. */
export interface Portal {
	/** The container the element moves into, once the document is there; `null` while it waits. */
	readonly container: HTMLElement | ShadowRoot | null;
	/** The portal element's own props: its marker and the move into the container. */
	readonly nodeProps: HTMLAttributes<HTMLElement>;
}

/** A portal that also manages focus across it, for a popup that takes focus. */
export interface FocusPortal extends Portal {
	/** Whether the two guards around the portal element render (an open non-modal popup). */
	readonly shouldRenderGuards: boolean;
	/** Spread on a `<span>` right before the portal element. */
	readonly beforeOutsideGuardProps: HTMLAttributes<HTMLSpanElement>;
	/** Spread on a `<span>` right after the portal element. */
	readonly afterOutsideGuardProps: HTMLAttributes<HTMLSpanElement>;
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
 * A closed shadow root hides its event path from the document, so Svelte's delegated handlers on
 * elements portalled into it (outside the mount target) never run. Svelte's `on` on the shadow
 * root runs them, from the event's target up to the root, in Svelte's own order. Returns the
 * release.
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
 * The move of a part's element into another container while it stays in its Svelte component
 * tree. The element is the only node of its block, so Svelte's removal of that block removes
 * exactly it; the teardown removes it otherwise (an enclosing block's removal only walks the
 * nodes left in place).
 */
function movePortalNode(
	options: () => PortalOptions,
	portal: FloatingPortalState,
	parent: FloatingPortalState | null,
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
			portal.portalNode = node;
		});
		return () => {
			release?.();
			node.remove();
			if (untrack(() => portal.portalNode) === node) {
				portal.portalNode = null;
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
		nodeProps: {
			[PORTAL_ATTRIBUTE]: "",
			[createAttachmentKey()]: attachPortal,
		} as HTMLAttributes<HTMLElement>,
	};
}

/**
 * A portal that only moves its element, for a popup that never takes focus (a tooltip). It
 * leaves its content's tab order alone and isn't the portal of the popups inside it: their
 * portals go where its own would. `options` is called inside the effect, so the container stays
 * reactive. Call during the Portal part's init.
 */
export function usePortal(options: () => PortalOptions): Portal {
	return movePortalNode(options, new FloatingPortalState(), FloatingPortalContext.getOr(null));
}

/**
 * A portal that also manages focus across it, for a popup that takes focus: it gives the focus
 * manager inside its state, keeps a non-modal popup's content out of the tab order until focus
 * enters it, and has the two outside guards a non-modal popup needs around its element. Popups
 * inside it portal into its element. Call during the Portal part's init.
 */
export function useFocusPortal(options: () => PortalOptions): FocusPortal {
	const parent = FloatingPortalContext.getOr(null);
	const portal = new FloatingPortalState();
	FloatingPortalContext.set(portal);
	const moved = movePortalNode(options, portal, parent);

	// Only the flags count, since a trigger switch replaces the focus manager's state while the
	// popup stays open.
	const modal = $derived(portal.focusManagerState?.modal === true);
	const open = $derived(portal.focusManagerState?.open === true);
	const shouldRenderGuards = $derived.by(() => {
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
		node.addEventListener("focusin", onFocus, true);
		node.addEventListener("focusout", onFocus, true);
		return () => {
			node.removeEventListener("focusin", onFocus, true);
			node.removeEventListener("focusout", onFocus, true);
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
		get shouldRenderGuards() {
			return shouldRenderGuards;
		},
		nodeProps: moved.nodeProps,
		beforeOutsideGuardProps: {
			...focusGuardProps(
				(event) => {
					const node = portal.portalNode;
					if (node && isOutsideEvent(event, node)) {
						portal.beforeInsideGuard?.focus();
					} else {
						getPreviousTabbable(portal.focusManagerState?.domReference ?? null)?.focus();
					}
				},
				{ "data-type": "outside" },
			),
			[createAttachmentKey()]: attachRef<HTMLElement>(
				(element) => (portal.beforeOutsideGuard = element),
			),
		} as HTMLAttributes<HTMLSpanElement>,
		afterOutsideGuardProps: {
			...focusGuardProps(
				(event) => {
					const node = portal.portalNode;
					if (node && isOutsideEvent(event, node)) {
						portal.afterInsideGuard?.focus();
					} else {
						const state = portal.focusManagerState;
						getNextTabbable(state?.domReference ?? null)?.focus();
						if (state?.closeOnFocusOut) {
							state.onOpenChange(false, event);
						}
					}
				},
				{ "data-type": "outside" },
			),
			[createAttachmentKey()]: attachRef<HTMLElement>(
				(element) => (portal.afterOutsideGuard = element),
			),
		} as HTMLAttributes<HTMLSpanElement>,
	};
}
