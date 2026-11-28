// Marks everything outside an open popup, reference-counted so nested popups compose: the inert
// marker that outside-press dismissal reads, and `aria-hidden` for a popup that hides the rest.
// The approach follows aria-hidden (https://github.com/theKashey/aria-hidden, MIT).

import { getNodeName, isShadowRoot, ownerDocument } from "../kernel/index.js";
import { INERT_MARKER } from "./focus-markers.js";

type Undo = () => void;

interface MarkOthersOptions {
	ariaHidden?: boolean | undefined;
	mark?: boolean | undefined;
}

let ariaHiddenCounterMap = new WeakMap<Element, number>();
let uncontrolledElementsSet = new WeakSet<Element>();
let markerCounterMap = new WeakMap<Element, number>();
let lockCount = 0;

function unwrapHost(node: Node | null): Element | null {
	if (!node) {
		return null;
	}
	return isShadowRoot(node) ? node.host : unwrapHost(node.parentNode);
}

function correctElements(parent: HTMLElement, targets: Element[]): Element[] {
	return targets
		.map((target) => {
			if (parent.contains(target)) {
				return target;
			}
			const corrected = unwrapHost(target);
			return parent.contains(corrected) ? corrected : null;
		})
		.filter((x): x is Element => x != null);
}

function buildKeepSet(targets: Element[]): Set<Node> {
	const keep = new Set<Node>();
	targets.forEach((target) => {
		let node: Node | null = target;
		while (node && !keep.has(node)) {
			keep.add(node);
			node = node.parentNode;
		}
	});
	return keep;
}

function collectOutsideElements(root: HTMLElement, keep: Set<Node>, stop: Set<Node>): Element[] {
	const outside: Element[] = [];
	const walk = (parent: Element | null) => {
		if (!parent || stop.has(parent)) {
			return;
		}
		Array.from(parent.children).forEach((node) => {
			if (getNodeName(node) === "script") {
				return;
			}
			if (keep.has(node)) {
				walk(node);
			} else {
				outside.push(node);
			}
		});
	};
	walk(root);
	return outside;
}

/**
 * Marks every element outside `avoidElements` (with `aria-hidden` when asked, and with the inert
 * marker), reference-counted so nested popups compose. Returns the undo.
 */
export function markOthers(avoidElements: Element[], options: MarkOthersOptions = {}): Undo {
	const { ariaHidden = false, mark = true } = options;
	const body = ownerDocument(avoidElements[0] ?? null).body;
	const avoid = correctElements(body, avoidElements);
	const markerTargets = mark
		? collectOutsideElements(body, buildKeepSet(avoid), new Set(avoid))
		: [];
	const hiddenElements: Element[] = [];
	const markedElements: Element[] = [];

	if (ariaHidden) {
		const ariaLive = correctElements(body, Array.from(body.querySelectorAll("[aria-live]")));
		const control = avoid.concat(ariaLive);
		collectOutsideElements(body, buildKeepSet(control), new Set(control)).forEach((node) => {
			const attr = node.getAttribute("aria-hidden");
			const alreadyHidden = attr !== null && attr !== "false";
			const counter = (ariaHiddenCounterMap.get(node) || 0) + 1;
			ariaHiddenCounterMap.set(node, counter);
			hiddenElements.push(node);
			if (counter === 1 && alreadyHidden) {
				uncontrolledElementsSet.add(node);
			}
			if (!alreadyHidden) {
				node.setAttribute("aria-hidden", "true");
			}
		});
	}

	markerTargets.forEach((node) => {
		const counter = (markerCounterMap.get(node) || 0) + 1;
		markerCounterMap.set(node, counter);
		markedElements.push(node);
		if (counter === 1) {
			node.setAttribute(INERT_MARKER, "");
		}
	});

	lockCount += 1;

	return () => {
		hiddenElements.forEach((element) => {
			const counter = (ariaHiddenCounterMap.get(element) || 0) - 1;
			ariaHiddenCounterMap.set(element, counter);
			if (!counter) {
				if (!uncontrolledElementsSet.has(element)) {
					element.removeAttribute("aria-hidden");
				}
				uncontrolledElementsSet.delete(element);
			}
		});
		markedElements.forEach((element) => {
			const counter = (markerCounterMap.get(element) || 0) - 1;
			markerCounterMap.set(element, counter);
			if (!counter) {
				element.removeAttribute(INERT_MARKER);
			}
		});
		lockCount -= 1;
		if (!lockCount) {
			ariaHiddenCounterMap = new WeakMap();
			uncontrolledElementsSet = new WeakSet();
			markerCounterMap = new WeakMap();
		}
	};
}
