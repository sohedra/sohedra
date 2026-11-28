// The page scroll lock a modal popup holds while open: one lock for the page, counted, so nested
// and stacked popups share it.
import { Timeout } from "@sohedra/primitives-core/foundation/kernel/index.js";

import {
	isOverflowElement,
	ownerDocument,
	ownerWindow,
	userAgent,
	webScheduler,
} from "../kernel/index.js";

/** Present on `<html>` while the page scroll is locked with inset scrollbars. */
const SCROLL_LOCKED_ATTRIBUTE = "data-sohedra-scroll-locked";

// The viewport's overflow comes from <html> when it scrolls itself, else from <body>.
function getViewportScroller(html: HTMLElement, body: HTMLElement) {
	return isOverflowElement(html) ? html : body;
}

function isPageScrollLocked(win: Window, html: HTMLElement, body: HTMLElement) {
	return /hidden|clip/.test(win.getComputedStyle(getViewportScroller(html, body)).overflowY);
}

function hasInsetScrollbars(pageElement: Element | null) {
	if (typeof document === "undefined") {
		return false;
	}
	const doc = ownerDocument(pageElement);
	return ownerWindow(doc.documentElement).innerWidth - doc.documentElement.clientWidth > 0;
}

function supportsStableScrollbarGutter(pageElement: Element | null) {
	const supported = typeof CSS !== "undefined" && CSS.supports?.("scrollbar-gutter", "stable");
	if (!supported || typeof document === "undefined") {
		return false;
	}
	const doc = ownerDocument(pageElement);
	const html = doc.documentElement;
	const scrollContainer = getViewportScroller(html, doc.body);
	const originalOverflowY = scrollContainer.style.overflowY;
	const originalGutter = html.style.scrollbarGutter;
	html.style.scrollbarGutter = "stable";
	scrollContainer.style.overflowY = "scroll";
	const before = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = "hidden";
	const after = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = originalOverflowY;
	html.style.scrollbarGutter = originalGutter;
	return before === after;
}

function preventScrollOverlayScrollbars(pageElement: Element | null) {
	const doc = ownerDocument(pageElement);
	// Lock <html> when it has an overflow style (a <body> lock wouldn't work), else <body>.
	const element = getViewportScroller(doc.documentElement, doc.body);
	const original = { overflowY: element.style.overflowY, overflowX: element.style.overflowX };
	Object.assign(element.style, { overflowY: "hidden", overflowX: "hidden" });
	return () => {
		Object.assign(element.style, original);
	};
}

function preventScrollInsetScrollbars(pageElement: Element | null) {
	const doc = ownerDocument(pageElement);
	const html = doc.documentElement;
	const body = doc.body;
	const win = ownerWindow(html);
	let scrollTop = 0;
	let scrollLeft = 0;
	let updateGutterOnly = false;
	let cancelResizeFrame: (() => void) | undefined;
	let originalHtml: Partial<CSSStyleDeclaration> = {};
	let originalBody: Partial<CSSStyleDeclaration> = {};
	let originalHtmlScrollBehavior = "";

	// WORKAROUND(safari): pinch-zoom shifts a locked page, so a zoomed page isn't locked. Remove
	// when Safari keeps a locked, zoomed page in place.
	if (userAgent.engine.webkit && (win.visualViewport?.scale ?? 1) !== 1) {
		return () => {};
	}

	function lockScroll() {
		const htmlStyles = win.getComputedStyle(html);
		const bodyStyles = win.getComputedStyle(body);
		const gutter = (htmlStyles.scrollbarGutter || "").includes("both-edges")
			? "stable both-edges"
			: "stable";
		scrollTop = html.scrollTop;
		scrollLeft = html.scrollLeft;
		originalHtml = {
			scrollbarGutter: html.style.scrollbarGutter,
			overflowY: html.style.overflowY,
			overflowX: html.style.overflowX,
		};
		originalHtmlScrollBehavior = html.style.scrollBehavior;
		originalBody = {
			position: body.style.position,
			height: body.style.height,
			width: body.style.width,
			boxSizing: body.style.boxSizing,
			overflowY: body.style.overflowY,
			overflowX: body.style.overflowX,
			scrollBehavior: body.style.scrollBehavior,
		};
		const isScrollableY = html.scrollHeight > html.clientHeight;
		const isScrollableX = html.scrollWidth > html.clientWidth;
		const constantOverflowY =
			htmlStyles.overflowY === "scroll" || bodyStyles.overflowY === "scroll";
		const constantOverflowX =
			htmlStyles.overflowX === "scroll" || bodyStyles.overflowX === "scroll";
		const scrollbarWidth = Math.max(0, win.innerWidth - body.clientWidth);
		const scrollbarHeight = Math.max(0, win.innerHeight - body.clientHeight);
		const marginY = parseFloat(bodyStyles.marginTop) + parseFloat(bodyStyles.marginBottom);
		const marginX = parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight);
		const elementToLock = getViewportScroller(html, body);
		updateGutterOnly = supportsStableScrollbarGutter(pageElement);

		if (updateGutterOnly) {
			html.style.scrollbarGutter = gutter;
			elementToLock.style.overflowY = "hidden";
			elementToLock.style.overflowX = "hidden";
			return;
		}
		Object.assign(html.style, {
			scrollbarGutter: gutter,
			overflowY: "hidden",
			overflowX: "hidden",
		});
		if (isScrollableY || constantOverflowY) {
			html.style.overflowY = "scroll";
		}
		if (isScrollableX || constantOverflowX) {
			html.style.overflowX = "scroll";
		}
		Object.assign(body.style, {
			position: "relative",
			height:
				marginY || scrollbarHeight ? `calc(100dvh - ${marginY + scrollbarHeight}px)` : "100dvh",
			width: marginX || scrollbarWidth ? `calc(100vw - ${marginX + scrollbarWidth}px)` : "100vw",
			boxSizing: "border-box",
			overflowY: "hidden",
			overflowX: "hidden",
			scrollBehavior: "unset",
		});
		body.scrollTop = scrollTop;
		body.scrollLeft = scrollLeft;
		html.setAttribute(SCROLL_LOCKED_ATTRIBUTE, "");
		html.style.scrollBehavior = "unset";
	}

	function cleanup() {
		Object.assign(html.style, originalHtml);
		Object.assign(body.style, originalBody);
		if (!updateGutterOnly) {
			html.scrollTop = scrollTop;
			html.scrollLeft = scrollLeft;
			html.removeAttribute(SCROLL_LOCKED_ATTRIBUTE);
			html.style.scrollBehavior = originalHtmlScrollBehavior;
		}
	}

	function handleResize() {
		cleanup();
		cancelResizeFrame?.();
		cancelResizeFrame = webScheduler.frame(lockScroll);
	}

	lockScroll();
	win.addEventListener("resize", handleResize);
	return () => {
		cancelResizeFrame?.();
		cleanup();
		win.removeEventListener("resize", handleResize);
	};
}

// One page lock, reference-counted across popups.
class ScrollLock {
	lockCount = 0;
	restore: (() => void) | null = null;
	timeoutLock = new Timeout(webScheduler);
	timeoutUnlock = new Timeout(webScheduler);

	acquire(pageElement: Element | null) {
		this.lockCount += 1;
		if (this.lockCount === 1 && this.restore === null) {
			this.timeoutLock.start(0, () => this.lock(pageElement));
		}
		return this.release;
	}

	release = () => {
		this.lockCount -= 1;
		if (this.lockCount === 0 && this.restore) {
			this.timeoutUnlock.start(0, this.unlock);
		}
	};

	private unlock = () => {
		if (this.lockCount === 0 && this.restore) {
			this.restore();
			this.restore = null;
		}
	};

	private lock(pageElement: Element | null) {
		if (this.lockCount === 0 || this.restore !== null) {
			return;
		}
		const doc = ownerDocument(pageElement);
		const html = doc.documentElement;
		const body = doc.body;
		const win = ownerWindow(html);
		// Already locked by someone else: wait for that lock to clear before taking over.
		if (isPageScrollLocked(win, html, body)) {
			const observer = new win.MutationObserver(() => {
				if (isPageScrollLocked(win, html, body)) {
					return;
				}
				observer.disconnect();
				this.restore = null;
				this.lock(pageElement);
			});
			observer.observe(html, { attributes: true });
			observer.observe(body, { attributes: true });
			this.restore = () => observer.disconnect();
			return;
		}
		// WORKAROUND(ios): iOS scrollbars always overlay the page, which the inset check can't tell.
		// Remove when the check sees them.
		const overlayScrollbars = userAgent.os.ios || !hasInsetScrollbars(pageElement);
		this.restore = overlayScrollbars
			? preventScrollOverlayScrollbars(pageElement)
			: preventScrollInsetScrollbars(pageElement);
	}
}

const SCROLL_LOCK = new ScrollLock();

/** Locks the page scroll; returns the release. Locks apply after a tick, reference-counted. */
export function acquireScrollLock(pageElement: Element | null): () => void {
	return SCROLL_LOCK.acquire(pageElement);
}
