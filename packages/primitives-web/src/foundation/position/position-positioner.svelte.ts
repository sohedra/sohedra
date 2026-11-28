import { autoUpdate, computePosition, type ReferenceElement } from "@floating-ui/dom";
import { keepShallowEqual, watch } from "@sohedra/primitives-core/foundation/kernel";
import type { PopupView } from "@sohedra/primitives-core/foundation/popup";
import {
	getAlignment,
	getSide,
	logicalSide,
	POSITIONER_DEFAULTS,
	type PositionerStore,
	type MeasuredPosition,
	requestedPlacement,
	roundToDevicePixels,
	samePosition,
} from "@sohedra/primitives-core/foundation/position";
import { flushSync, untrack } from "svelte";
import type { Attachment } from "svelte/attachments";

import { attachmentProps, isElement, type WebTypes } from "../kernel/index.js";
import {
	createPositionerMiddleware,
	getDevicePixelRatio,
	type Measured,
	type MiddlewareOptions,
} from "./position-positioner-middleware.js";
import { internalBackdropStyle, positionerStyle } from "./position-positioner-style.js";
import type { Positioner, PositionerOptions } from "./position-types.js";

/**
 * Positions a popup against its anchor while it is mounted and writes each result to
 * `positioner`, the state the parts derive their styles from. `options` is read inside deriveds,
 * so each option stays reactive; `fixed.popup` is the popup's store.
 */
export function usePositioner(
	positioner: PositionerStore<WebTypes>,
	options: () => PositionerOptions,
	fixed: { readonly popup: PopupView<WebTypes> },
): Positioner {
	const popup = fixed.popup;
	// Compared by value, one derived per option: what reads them (the recompute watch, the
	// subscription, the styles) runs again only when that option's value changes, not whenever
	// the part builds its options again.
	const sideOffset = $derived.by(
		keepShallowEqual(() => options().sideOffset ?? POSITIONER_DEFAULTS.sideOffset),
	);
	const alignOffset = $derived.by(
		keepShallowEqual(() => options().alignOffset ?? POSITIONER_DEFAULTS.alignOffset),
	);
	const positionMethod = $derived(options().positionMethod ?? "absolute");
	const collisionPadding = $derived.by(
		keepShallowEqual(() => options().collisionPadding ?? POSITIONER_DEFAULTS.collisionPadding),
	);
	const collisionBoundary = $derived.by(
		keepShallowEqual(() => options().collisionBoundary ?? "clipping-ancestors"),
	);
	const collisionAvoidance = $derived.by(keepShallowEqual(() => options().collisionAvoidance));
	const sticky = $derived(options().sticky ?? POSITIONER_DEFAULTS.sticky);
	const arrowPadding = $derived(options().arrowPadding ?? POSITIONER_DEFAULTS.arrowPadding);
	const disableAnchorTracking = $derived(options().disableAnchorTracking ?? false);
	const side = $derived(options().side ?? "bottom");
	const align = $derived(options().align ?? "center");
	const rtl = $derived(options().rtl);
	const keepMounted = $derived(options().keepMounted);
	const anchor = $derived(options().anchor);
	const layout = $derived(options().layout);

	const placement = $derived(requestedPlacement({ side, align, rtl }));

	// The anchor the popup is positioned against: the `anchor` option, else the active trigger.
	const anchorElement = $derived.by((): ReferenceElement | null => {
		const resolved = typeof anchor === "function" ? anchor() : anchor;
		if (resolved) {
			return isElement(resolved)
				? {
						getBoundingClientRect: () => resolved.getBoundingClientRect(),
						getClientRects: () => resolved.getClientRects(),
						contextElement: resolved,
					}
				: resolved;
		}
		return popup.anchorElement;
	});

	// The options one computation reads: when it is created, and (side, rtl, the arrow) while it
	// runs.
	const middlewareOptions: MiddlewareOptions = {
		get side() {
			return side;
		},
		get align() {
			return align;
		},
		get rtl() {
			return rtl;
		},
		get sideOffset() {
			return sideOffset;
		},
		get alignOffset() {
			return alignOffset;
		},
		get sticky() {
			return sticky;
		},
		get arrowPadding() {
			return arrowPadding;
		},
		get collisionPadding() {
			return collisionPadding;
		},
		get collisionBoundary() {
			return collisionBoundary;
		},
		get collisionAvoidance() {
			return collisionAvoidance;
		},
		get adaptiveOrigin() {
			return layout?.adaptiveOrigin ?? false;
		},
		get arrowElement() {
			return positioner.arrowElement as HTMLElement | null;
		},
	};

	// Local bookkeeping: a computation that a newer one or a resubscription superseded is dropped.
	let generation = 0;

	function update(currentAnchor: ReferenceElement, positionerElement: HTMLElement) {
		const current = ++generation;
		const measured: Measured = {};
		void computePosition(currentAnchor, positionerElement, {
			placement,
			strategy: positionMethod,
			middleware: createPositionerMiddleware(middlewareOptions, measured),
		}).then((data) => {
			if (current !== generation) {
				return;
			}
			const renderedSide = getSide(data.placement);
			const dpr = getDevicePixelRatio(positionerElement);
			const arrow = data.middlewareData.arrow;
			const next: MeasuredPosition = {
				// A kept-mounted popup computed while closed must start unpositioned on the next open.
				isPositioned: !keepMounted || popup.mounted,
				x: roundToDevicePixels(data.x, dpr),
				y: roundToDevicePixels(data.y, dpr),
				strategy: data.strategy,
				side: logicalSide(side, renderedSide, rtl),
				physicalSide: renderedSide,
				align: getAlignment(data.placement) || "center",
				anchorHidden: Boolean(data.middlewareData.hide?.referenceHidden),
				arrow: arrow ? { x: arrow.x, y: arrow.y, centerOffset: arrow.centerOffset } : null,
				...measured,
				sides: (data.middlewareData.adaptiveOrigin as MeasuredPosition["sides"]) ?? undefined,
			};
			if (!samePosition(positioner.position, next)) {
				positioner.setPosition(next);
				// Applied now, not a microtask later, so the styles land before the next paint.
				flushSync();
			}
		});
	}

	const attach: Attachment<HTMLElement> = (positionerElement) => {
		// Follows the anchor while mounted. Subscribes again only when the anchor, the element or
		// mounting changes; the options are read when a position is computed.
		$effect(() => {
			const currentAnchor = anchorElement;
			const mounted = popup.mounted;
			const disableTracking = disableAnchorTracking;
			if (!mounted || !currentAnchor) {
				return;
			}
			const cleanup = untrack(() =>
				autoUpdate(
					currentAnchor,
					positionerElement,
					() => update(currentAnchor, positionerElement),
					{
						ancestorScroll: !disableTracking,
						elementResize: !disableTracking && typeof ResizeObserver !== "undefined",
						layoutShift: !disableTracking && typeof IntersectionObserver !== "undefined",
					},
				),
			);
			return () => {
				generation += 1;
				cleanup();
			};
		});

		// Computes again when a placement option changes while mounted. Not on the first run,
		// whatever the options are by then (an Arrow inside registers in the same update): the
		// subscription above has just computed.
		watch(
			[
				() => placement,
				() => sideOffset,
				() => alignOffset,
				() => positionMethod,
				() => collisionPadding,
				() => collisionBoundary,
				() => collisionAvoidance,
				() => sticky,
				() => arrowPadding,
				() => positioner.arrowElement,
				() => layout?.adaptiveOrigin,
			],
			(_, [previousPlacement]) => {
				const currentAnchor = anchorElement;
				if (previousPlacement !== undefined && popup.mounted && currentAnchor) {
					update(currentAnchor, positionerElement);
				}
			},
		);
	};

	const style = $derived(
		positionerStyle(
			positioner.position,
			popup.positionerElement as HTMLElement | null,
			positionMethod,
			layout?.positionerStyle,
			options().inert ?? false,
		),
	);

	// Computed again on every position update: a trigger that moved while open moves its cut-out
	// too.
	const backdropStyle = $derived.by(() => {
		void positioner.position;
		return internalBackdropStyle(popup.activeTriggerElement);
	});

	return {
		props: attachmentProps(attach),
		get style() {
			return style;
		},
		get backdropStyle() {
			return backdropStyle;
		},
	};
}
