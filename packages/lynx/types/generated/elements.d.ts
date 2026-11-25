// Generated from @lynx-js/types 4.4.2 by `pnpm -F @sohedra/lynx generate`. Do not edit:
// change scripts/types/ and generate again.
//
// Lynx's elements as a Svelte component writes them: each element's attributes, its events in
// the binding's spellings, the events its listeners hear and its UI methods. The doc comments
// are Lynx's, adapted from @lynx-js/types (Apache License 2.0).

import type {
	LynxElementAttributes,
	LynxEvent,
	LynxEventHandler,
	LynxNode,
	MainThread,
	MainThreadEventHandler,
} from "../elements.js";

export interface LynxHandle {
	/** Center X of handle */
	x: number;
	/** Center Y of handle */
	y: number;
	/** Touch radius of the handle */
	radius: number;
}

/** A single animation entry. Supported since Lynx 4.4. */
export interface LynxListAnimationEntry {
	/** The animation type for this entry. */
	type: "remove" | "move" | "add" | "change";
	/** Duration in milliseconds. Negative values become zero; fractions are truncated. */
	duration: number;
}

/** Animation lifecycle events are grouped by transaction and animation type. */
export interface LynxListAnimationInfo {
	/** Identifies the list update animation transaction. */
	transactionId: number;
	/** The animation type within the transaction. */
	type: "remove" | "move" | "add" | "change";
}

/**
 * The legacy stage syntax remains supported for compatibility.
 * @deprecated Use ListAnimationStage with type/duration entries instead.
 */
export interface LynxListAnimationLegacyStage {
	/**
	 * Animation types that run concurrently in this stage.
	 * @deprecated Use the type field of each ListAnimationEntry instead.
	 */
	animations: ("remove" | "move" | "add" | "change")[];
	/**
	 * A shared duration, or one duration per animation, in milliseconds.
	 * @deprecated Use the duration field of each ListAnimationEntry instead.
	 */
	durations: number | number[];
}

/** Progress details for an animation type within a transaction. */
export interface LynxListAnimationUpdateInfo {
	/** Animation progress reported for this type. */
	progress: number;
	/** Identifies the list update animation transaction. */
	transactionId: number;
	/** The animation type within the transaction. */
	type: "remove" | "move" | "add" | "change";
}

export interface LynxListAttachedCell {
	/** id of list item */
	id: string;
	/** item-key of list item */
	itemKey: string;
	/** index of list item */
	index: number;
	/** left position of list item relative to list, in px */
	left: number;
	/** top position of list item relative to list, in px */
	top: number;
	/** right position of list item relative to list, in px */
	right: number;
	/** bottom position of list item relative to list, in px */
	bottom: number;
}

export interface LynxListItemInfo {
	/** Height of the list item, in px. */
	height: number;
	/** Width of the list item, in px. */
	width: number;
	/** ItemKey of the list-item. */
	itemKey: string;
	/** When the list is running in multi-thread mode, this property indicates whether the item is currently being rendered and has not finished rendering. In this state, the item will have a default height that is the same as the list's height or an estimated height if one has been set. */
	isBinding: boolean;
	/** The x coordinate of the item's top-left corner, in px. The axis is based on the total length of the content rather than the visible area or screen. */
	originX: number;
	/** The y coordinate of the item's top-left corner, in px. The axis is based on the total length of the content rather than the visible area or screen. */
	originY: number;
	/** Show if the list-item is currently being updated in this layout. */
	updated: boolean;
}

export interface LynxListItemSnapAlignment {
	/** Paging factor, 0.0 means align to the top, while 1.0 means align to the bottom. */
	factor: number;
	/** In addition to the parameter of factor, an offset for alignment can be set, in px. */
	offset: number;
	/**
	 * The maximum number of list items that one fling can snap across.
	 * @defaultValue 1
	 */
	maxSnapCount?: number;
}

export interface LynxListLayoutCompleteInfo {
	/**
	 * Connected to a setState.
	 * @defaultValue -1
	 */
	"layout-id"?: number;
	/** The diffResult of current layout change. If this diffResult is undefined, it means that the layout is triggered by a list-item update. */
	diffResult?: {
		insertions: number[];
		removals: number[];
		move_from: number[];
		move_to: number[];
		update_from: number[];
		update_to: number[];
	};
	/** Cell info of the list before layout. */
	visibleItemBeforeUpdate?: LynxListItemInfo[];
	/** Cell info of the list after layout. */
	visibleItemAfterUpdate?: LynxListItemInfo[];
	/** The scroll info after layout. */
	scrollInfo: LynxListScrollInfo;
}

export interface LynxListScrollInfo {
	/** Horizontal scroll offset since the last scroll, in px. */
	deltaX: number;
	/** Vertical scroll offset since the last scroll, in px. */
	deltaY: number;
	/** Current horizontal scroll offset, in px. */
	scrollLeft: number;
	/** Current vertical scroll offset, in px. */
	scrollTop: number;
	/** Current content area width, in px. */
	scrollWidth: number;
	/** Current content area height, in px. */
	scrollHeight: number;
	/** list width, in px. */
	listWidth: number;
	/** list height, in px. */
	listHeight: number;
	/** Source of the event. */
	eventSource: 0 | 1 | 2;
	/** Information of the currently rendering list items. */
	attachedCells: LynxListAttachedCell[];
}

export interface LynxListScrollStateInfo {
	/** scroll state */
	state: 1 | 2 | 3 | 4;
}

export interface LynxListSnapInfo {
	/** The index of the node that will be paginated to. */
	position: number;
	/** Current scrolling left offset, in px. */
	currentScrollLeft: number;
	/** Current scrolling top offset, in px. */
	currentScrollTop: number;
	/** Snap scrolling left offset, in px. */
	targetScrollLeft: number;
	/** Snap scrolling top offset, in px. */
	targetScrollTop: number;
}

/** Configuration for the new C++ list update animation implementation. */
export interface LynxListUpdateAnimationConfig {
	/**
	 * Whether to animate list updates.
	 * @defaultValue false
	 */
	enable?: boolean;
	/**
	 * Stages run sequentially; entries within a stage run concurrently.
	 * All stages must use the same syntax.
	 * @defaultValue ```ts [ { type: 'remove', duration: 120 }, [{ type: 'move', duration: 250 }, { type: 'change', duration: 250 }], { type: 'add', duration: 120 }, ] ```
	 */
	stages?: (LynxListAnimationEntry | LynxListAnimationEntry[])[] | LynxListAnimationLegacyStage[];
}

/** Decoration and optional click target for the text range [startIndex, endIndex). */
export interface LynxMarkdownTextAttachment {
	/**
	 * Inclusive start index in the text selected by indexType.
	 * @defaultValue 0
	 */
	startIndex: number;
	/**
	 * Exclusive end index in the text selected by indexType.
	 * @defaultValue 0
	 */
	endIndex: number;
	/**
	 * 'char' indexes parsed text; 'source' indexes the original Markdown source.
	 * @defaultValue 'char'
	 */
	indexType?: "char" | "source";
	/**
	 * Whether the decoration is drawn behind or in front of the text.
	 * @defaultValue 'background'
	 */
	layer?: "background" | "foreground";
	/**
	 * Identifier returned by the textClick event when this attachment is clicked.
	 * @defaultValue ''
	 */
	id?: string;
	/**
	 * Whether the text range can emit a textClick event.
	 * @defaultValue false
	 */
	clickable?: boolean;
	/**
	 * Background and border decoration for the text range.
	 * @defaultValue {} (no decoration)
	 */
	style?: LynxMarkdownTextAttachmentStyle;
}

/** Styling for one border of a text attachment. */
export interface LynxMarkdownTextAttachmentBorder {
	/**
	 * Border line style accepted by the Markdown parser.
	 * Attachment borders currently render solid and dashed lines.
	 * @defaultValue 'none'
	 */
	lineType?: "none" | "solid" | "dashed" | "dotted" | "double" | "wavy";
	/**
	 * Border width, as a native length number or string such as '2px'.
	 * @defaultValue 0
	 */
	width?: string | number;
	/**
	 * Hexadecimal color or a supported linear-gradient()/radial-gradient() string.
	 * @defaultValue '#00000000' (transparent)
	 */
	color?: string;
	/**
	 * Length of each dash in a dashed border.
	 * @defaultValue 2.5 density-independent pixels
	 */
	elementSize?: string | number;
	/**
	 * Requested gap between dashes; spacing may be adjusted to fit the border.
	 * @defaultValue 1.5 density-independent pixels
	 */
	emptySize?: string | number;
}

/** Background and border decoration for the rectangle covering a text range. */
export interface LynxMarkdownTextAttachmentStyle {
	/**
	 * Left edge offset from the text range's left edge.
	 * @defaultValue 0
	 */
	left?: string | number;
	/**
	 * Top edge offset from the text range's top edge.
	 * @defaultValue 0
	 */
	top?: string | number;
	/**
	 * Right edge offset from the text range's left edge, not a right inset.
	 * @defaultValue '100%' (the text range's width)
	 */
	right?: string | number;
	/**
	 * Bottom edge offset from the text range's top edge, not a bottom inset.
	 * @defaultValue '100%' (the text range's height)
	 */
	bottom?: string | number;
	/**
	 * Corner radius of the background rectangle.
	 * @defaultValue 0
	 */
	radius?: string | number;
	/**
	 * Hexadecimal fill color or a supported linear-gradient()/radial-gradient() string.
	 * @defaultValue '#00000000' (transparent)
	 */
	color?: string;
	/**
	 * Left border decoration.
	 * @defaultValue {} (no border)
	 */
	borderLeft?: LynxMarkdownTextAttachmentBorder;
	/**
	 * Top border decoration.
	 * @defaultValue {} (no border)
	 */
	borderTop?: LynxMarkdownTextAttachmentBorder;
	/**
	 * Right border decoration.
	 * @defaultValue {} (no border)
	 */
	borderRight?: LynxMarkdownTextAttachmentBorder;
	/**
	 * Bottom border decoration.
	 * @defaultValue {} (no border)
	 */
	borderBottom?: LynxMarkdownTextAttachmentBorder;
}

export interface LynxOverlayError {
	/** Error code: 0 - Display normally; non-0 - Unable to display, you can try to solve it by using the preloading scheme mentioned below for adapting containers. */
	errorCode: string;
	/** Error message */
	errorMsg: string;
}

export interface LynxOverlayTouch {
	/** x position relative to the window, in px */
	x: number;
	/** y position relative to the window, in px */
	y: number;
	/** Touch state */
	state: 0 | 1 | 2 | 3;
}

export interface LynxRect {
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
}

export interface LynxRefreshHeaderOffset {
	/** Indicates if `<refresh-header>` is being dragged */
	isDragging: boolean;
	/** The ratio of the pull-down movement distance to its own height */
	offsetPercent: number;
}

export interface LynxRefreshStartRefresh {
	/** Indicates whether the startrefresh event is triggered by manual drag */
	isManual: boolean;
}

export interface LynxRefreshStateChange {
	/** Indicates if `<refresh-header>` is being dragged */
	state: number;
}

export interface LynxScrollCoordinatorOffset {
	/** The absolute value of the header scroll offset, in px */
	offset: number;
	/** The absolute value of the scrollable distance (header height - toolbar height), in px */
	height: number;
}

export interface LynxScrollInfo {
	/** scroll top from start */
	scrollTop: number;
	/** scroll left from start */
	scrollLeft: number;
	/** scroll content height */
	scrollHeight: number;
	/** scroll content width */
	scrollWidth: number;
	/** X-axis scroll delta for this scroll. It's always 0 in some non-scroll related events. */
	deltaX: number;
	/** Y-axis scroll delta for this scroll. It's always 0 in some non-scroll related events. */
	deltaY: number;
}

export interface LynxTextLineInfo {
	start: number;
	end: number;
	ellipsisCount: number;
}

export interface LynxTouch {
	/** The unique identifier of the finger touching the screen. */
	identifier: number;
	/** The current position of the touch point relative to the touched element's x-coordinate. */
	x: number;
	/** The current position of the touch point relative to the touched element's y-coordinate. */
	y: number;
	/** The current position of the touch point relative to the page's x-coordinate. */
	pageX: number;
	/** The current position of the touch point relative to the page's y-coordinate. */
	pageY: number;
	/** The current position of the touch point relative to the display area's x-coordinate. */
	clientX: number;
	/** The current position of the touch point relative to the display area's y-coordinate. */
	clientY: number;
}

export interface LynxVideoMethodResponse {
	/** Whether the operation succeeded when provided by the platform callback. */
	success?: boolean;
	/** Error code when the operation fails. */
	errorCode?: number;
	/** Error message when the operation fails. */
	msg?: string;
	/** Error message when the operation fails. */
	errorMsg?: string;
}

export interface LynxViewPagerChange {
	/** Current index */
	index: number;
	/** If this change event is caused by the user's dragging */
	isDragged: boolean;
}

export interface LynxViewPagerOffsetChange {
	/** The scrolling offset */
	offset: number;
}

/** Cookie Object */
export interface LynxWebviewCookie {
	/** The name of the cookie */
	name: string;
	/** The value of the cookie */
	value: string;
	/** The domain of the cookie */
	domain?: string;
	/** Whether the cookie is HTTP only */
	hostOnly?: boolean;
	/** The path of the cookie */
	path?: string;
	/** Whether the cookie is marked as secure */
	secure?: boolean;
	/** Whether the cookie is HTTP only */
	httpOnly?: boolean;
	/** Whether the cookie is a session cookie or a persistent cookie with an expiration date */
	session?: boolean;
	/** The expiration date of the cookie as the number of seconds since the UNIX epoch */
	expirationDate?: number;
	/** The Same Site policy to apply to this cookie */
	sameSite: string;
}

export interface LynxAccessibilityActionEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** The name of the custom action. */
		name: string;
	};
}

export interface LynxAnimationEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Animation params. */
	readonly params: {
		/** Animation type. */
		animation_type: "keyframe-animation";
		/** Animation name. */
		animation_name: string;
		/** If new animator enabled. */
		new_animator?: true;
	};
	/** Additional information. */
	readonly detail: {};
}

export interface LynxCommonEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxContentSizeChangedEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxScrollInfo;
}

export interface LynxErrorEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Error message. */
		errMsg: string;
		/** Error code. */
		error_code: number;
		/** Categorized error code. */
		lynx_categorized_code: number;
		/** Additional information. */
		detail: {};
	};
}

export interface LynxFilterImageErrorEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	readonly detail: {
		errMsg: string;
	};
}

/** Provides image blur and shadow features, similar to the usage of images. Specially, shadow and blur effects can be displayed inside the padding area. */
export interface LynxFilterImageLoadEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	readonly detail: {
		width: number;
		height: number;
	};
}

export interface LynxImageErrorEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Error message. */
	readonly errMsg: string;
	/** Error code. */
	readonly error_code: number;
	/** Categorized error code. */
	readonly lynx_categorized_code: number;
	/** Additional information. */
	readonly detail: {};
}

export interface LynxImageLoadEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Image width. In pixels. */
	readonly width: number;
	/** Image height. In pixels. */
	readonly height: number;
	/** Additional information. */
	readonly detail: {};
}

export interface LynxInputBlurEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxInputConfirmEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxInputEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
		/** The start position of the selection */
		selectionStart: number;
		/** The end position of the selection */
		selectionEnd: number;
		/** Is composing or not */
		isComposing?: boolean;
		/** The type of input action, "paste" when pasting, "normal" otherwise */
		inputType?: "normal" | "paste";
	};
}

export interface LynxInputFocusEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxInputSelectionEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** The start position of the selection */
		selectionStart: number;
		/** The end position of the selection */
		selectionEnd: number;
	};
}

export interface LynxKeyEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Button Name */
	readonly key: string;
	/** Whether the key is being held down and is automatically repeating. */
	readonly repeat: boolean;
	/** Whether the Alt key is pressed. */
	readonly altKey: boolean;
	/** Whether the Shift key is pressed. */
	readonly shiftKey: boolean;
	/** Whether the Control key is pressed. */
	readonly ctrlKey: boolean;
	/** Whether the Meta key is pressed. */
	readonly metaKey: boolean;
	/** Additional information. */
	readonly detail: {};
}

export interface LynxLayoutChangeEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** @deprecated Use 'detail' field instead. This field is only available on the Android platform. */
	readonly params: {
		width: number;
		height: number;
		left: number;
		top: number;
		right: number;
		bottom: number;
	};
	/** This field is available on other platforms. */
	readonly detail: {
		/** The id selector of the target. */
		id: string;
		/** The width of the target. In pixels. */
		width: number;
		/** The height of the target. In pixels. */
		height: number;
		/** The position of the target's top border relative to the page's coordinate. In pixels. */
		top: number;
		/** The position of the target's right border relative to the page's coordinate. In pixels. */
		right: number;
		/** The position of the target's bottom border relative to the page's coordinate. In pixels. */
		bottom: number;
		/** The position of the target's left border relative to the page's coordinate. In pixels. */
		left: number;
		/** The collection of custom attributes starting with data- on the event target. */
		dataset: {
			[key: string]: unknown;
		};
	};
}

export interface LynxLayoutEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		lineCount: number;
		lines: LynxTextLineInfo[];
		size: {
			width: number;
			height: number;
		};
	};
}

/** A started, unfinished animation type is canceled. */
export interface LynxListAnimationCancelEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListAnimationInfo;
}

/** All participating items of an animation type finish normally. */
export interface LynxListAnimationEndEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListAnimationInfo;
}

/** An animation type starts within a transaction. */
export interface LynxListAnimationStartEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListAnimationInfo;
}

/** Progress updates for an animation type within a transaction. */
export interface LynxListAnimationUpdateEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListAnimationUpdateInfo;
}

export interface LynxListLayoutCompleteEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListLayoutCompleteInfo;
}

export interface LynxListScrollEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxListScrollInfo;
}

export interface LynxListScrollStateChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListScrollStateInfo;
}

export interface LynxListScrollToLowerEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListScrollInfo;
}

export interface LynxListScrollToUpperEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxListScrollInfo;
}

export interface LynxListSnapEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxListSnapInfo;
}

export interface LynxLoadEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Image start loading timestamp, Unit (ms). */
		load_start?: number;
		/** Image loading completion timestamp, Unit (ms). It mainly includes image downloading and image decoding. */
		load_finish?: number;
		/** Image loading duration (load_finish - load_start), Unit (ms). */
		cost?: number;
		/** image URI. */
		src?: string;
		/** image view width. Unit: (px) */
		view_width?: number;
		/** image view height. Unit: (px) */
		view_height?: number;
		/** Image memory size, Unit: Byte (B). */
		memory_cost?: number;
		/** Source of image, network download, memory cache or disk cache. */
		origin?: number;
		/** Image width. In pixels. */
		width: number;
		/** Image height. In pixels. */
		height: number;
		/** Additional information. */
		detail: {};
	};
}

export interface LynxMarkdownAnimationStepEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Current step of animation. */
		animationStep: number;
		/** Maximum step of animation. */
		maxAnimationStep: number;
	};
}

export interface LynxMarkdownImageTapEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Image url. */
		url: string;
	};
}

export interface LynxMarkdownLinkEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Link url. */
		url: string;
		/** Link text. */
		content: string;
	};
}

export interface LynxMarkdownOverflowEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/**
		 * Type of overflow.
		 * ellipsis: overflow text will be replaced by ... or truncation view.
		 * clip: overflow text will be clipped.
		 */
		type: "clip" | "ellipsis";
	};
}

export interface LynxMarkdownParseEndEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** The id of content that parsed. */
		id: string;
	};
}

export interface LynxMarkdownSelectionChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Start char pos of selection range. */
		start: number;
		/** End char pos of selection range. */
		end: number;
		/** Direction of selection. */
		direction: "forward" | "backward";
	};
}

export interface LynxMarkdownTextClickEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** ID of the clicked text attachment. */
		id: string;
	};
}

export interface LynxMouseEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** The currently pressed mouse button, if multiple buttons are pressed simultaneously, is the last one pressed. */
	readonly button: number;
	/** The current mouse button being pressed, if multiple buttons are simultaneously pressed, it is a bit field composed of all button codes. */
	readonly buttons: number;
	/** Current scale factor. Greater than 1 means zoom in. Less than 1 means zoom out. */
	readonly scale: number;
	/** clientX */
	readonly x: number;
	/** clientY */
	readonly y: number;
	/** The current position of the cursor relative to the page's x-coordinate. */
	readonly pageX: number;
	/** The current position of the cursor relative to the page's y-coordinate. */
	readonly pageY: number;
	/** The current position of the cursor relative to the element's x-coordinate. */
	readonly clientX: number;
	/** The current position of the cursor relative to the element's y-coordinate. */
	readonly clientY: number;
	/** Additional information. */
	readonly detail: {};
}

export interface LynxOverlayErrorEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxOverlayError;
}

export interface LynxOverlayTouchEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxOverlayTouch;
}

/**
 * Native desktop pointer events require the refactored event dispatcher
 * (`enableEventHandleRefactor`). CSS `pointer-events` is independent of it.
 */
export interface LynxPointerEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	readonly pointerId: number;
	readonly pointerType: "mouse" | "pen" | "touch";
	readonly isPrimary: boolean;
	readonly button: number;
	readonly buttons: number;
	readonly x: number;
	readonly y: number;
	readonly pageX: number;
	readonly pageY: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly offsetX: number;
	readonly offsetY: number;
	readonly width: number;
	readonly height: number;
	readonly pressure: number;
	readonly tangentialPressure: number;
	readonly tiltX: number;
	readonly tiltY: number;
	readonly twist: number;
	readonly altKey?: boolean;
	readonly ctrlKey?: boolean;
	readonly shiftKey?: boolean;
	readonly metaKey?: boolean;
	readonly relatedTarget: null | LynxNode;
}

export interface LynxRefreshHeaderOffsetEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxRefreshHeaderOffset;
}

export interface LynxRefreshStartRefreshEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxRefreshStartRefresh;
}

export interface LynxRefreshStateChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxRefreshStateChange;
}

export interface LynxScrollCoordinatorOffsetEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxScrollCoordinatorOffset;
}

export interface LynxScrollEndEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxScrollInfo;
}

export interface LynxScrollEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: LynxScrollInfo;
}

export interface LynxScrollToLowerEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxScrollInfo;
}

export interface LynxScrollToUpperEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxScrollInfo;
}

export interface LynxSelectionChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		start: number;
		end: number;
		direction: "forward" | "backward";
	};
}

export interface LynxTextAreaBlurEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxTextAreaConfirmEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxTextAreaFocusEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
	};
}

export interface LynxTextAreaInputEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Input content */
		value: string;
		/** The start position of the selection */
		selectionStart: number;
		/** The end position of the selection */
		selectionEnd: number;
		/** Is composing or not */
		isComposing?: boolean;
		/** The type of input action, "paste" when pasting, "normal" otherwise */
		inputType?: "normal" | "paste";
	};
}

export interface LynxTextAreaSelectionChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** The start position of the selection */
		selectionStart: number;
		/** The end position of the selection */
		selectionEnd: number;
	};
}

export interface LynxTouchEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Collection of touch points currently on the touch plane. */
	readonly touches: LynxTouch[];
	/** Collection of touch points whose state has changed compared to the last touch event. */
	readonly changedTouches: LynxTouch[];
	/** Additional information. */
	readonly detail: {
		/** The current position of the touch point relative to the page's x-coordinate. */
		x: number;
		/** The current position of the touch point relative to the page's y-coordinate. */
		y: number;
	};
}

export interface LynxTransitionEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	readonly params:
		| {
				animation_type: "transition-animation";
				animation_name:
					| "left"
					| "right"
					| "top"
					| "bottom"
					| "opacity"
					| "width"
					| "height"
					| "background-color";
				new_animator: true;
		  }
		| {
				new_animator: undefined;
				animation_name: undefined;
				animation_type:
					| "transition-width"
					| "transition-height"
					| "transition-left"
					| "transition-top"
					| "transition-right"
					| "transition-bottom"
					| "transition-transform"
					| "transition-background-color"
					| "transition-opacity";
		  };
	/** Additional information. */
	readonly detail: {};
}

export interface LynxUIAppearanceEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** exposure-id set on the target. */
		"exposure-id": string;
		/** exposure-scene set on the target. */
		"exposure-scene": string;
		/** uid of the target */
		"unique-id": string;
		/** The collection of custom attributes starting with data- on the event target. */
		dataset: {
			[key: string]: unknown;
		};
	};
}

export interface LynxVideoBufferingEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Buffered end position on the media timeline, in seconds. */
		buffering: number;
	};
}

export interface LynxVideoEndedEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxVideoErrorEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** Platform playback error code. */
		errorCode: number;
		/** Platform playback error message. */
		errorMsg: string;
	};
}

export interface LynxVideoFirstFrameEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Total video duration, in seconds. */
		duration: number;
	};
}

export interface LynxVideoLoopedEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxVideoPausedEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxVideoPlayingEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxVideoStoppedEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: unknown;
}

export interface LynxVideoTimeUpdateEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** Current playback position, in seconds. */
		current: number;
		/** Total video duration, in seconds. */
		duration: number;
	};
}

export interface LynxViewPagerChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxViewPagerChange;
}

export interface LynxViewPagerOffsetChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxViewPagerOffsetChange;
}

export interface LynxViewPagerWillChangeEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: LynxViewPagerChange;
}

export interface LynxWebviewErrorEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** A string that represents the error message */
		errorMsg: string;
		/** A number that represents the error code */
		errorCode: number;
	};
}

export interface LynxWebviewMessageEvent<
	Target = LynxNode,
	CurrentTarget = Target,
> extends LynxEvent<Target, CurrentTarget> {
	/** Additional information. */
	readonly detail: {
		/** A string that represents the message */
		msg: string;
	};
}

export interface LynxWebviewUrlEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** Additional information. */
	readonly detail: {
		/** A string that represents the target url */
		url: string;
	};
}

export interface LynxWheelEvent<Target = LynxNode, CurrentTarget = Target> extends LynxEvent<
	Target,
	CurrentTarget
> {
	/** clientX */
	readonly x: number;
	/** clientY */
	readonly y: number;
	/** The current position of the cursor relative to the page's x-coordinate. */
	readonly pageX: number;
	/** The current position of the cursor relative to the page's y-coordinate. */
	readonly pageY: number;
	/** The current position of the cursor relative to the element's x-coordinate. */
	readonly clientX: number;
	/** The current position of the cursor relative to the element's y-coordinate. */
	readonly clientY: number;
	/** The distance of x-axis scrolling on the mouse wheel. */
	readonly deltaX: number;
	/** The distance of y-axis scrolling on the mouse wheel. */
	readonly deltaY: number;
	/** Additional information. */
	readonly detail: {};
}

/** The attributes and events every element has. */
export interface LynxCommonAttributes<
	Tag extends string = string,
> extends LynxElementAttributes<Tag> {
	/**
	 * Class name of the containing UITableViewCell whose accessibility elements should be updated with this element.
	 * @defaultValue Unset; no containing cell class is configured.
	 */
	"accessibility-attached-cell-class"?: string | null;
	/**
	 * Scroll to this element when it receives accessibility focus programmatically.
	 * @defaultValue false
	 */
	"accessibility-auto-scroll-if-focused"?: boolean | null;
	/**
	 * Enable accessibility tap actions for this element.
	 * @defaultValue false
	 */
	"accessibility-enable-tap"?: boolean | "true" | "false" | null;
	/**
	 * Enable edge antialiasing on the view layer and its background.
	 * @defaultValue false
	 */
	"allow-edge-antialiasing"?: boolean | null;
	/**
	 * Keep accessibility focus on this element when the accessibility helper updates.
	 * @defaultValue false
	 */
	"android-accessibility-keep-focused"?: boolean | "true" | "false" | null;
	/**
	 * Consume hover events in the accessibility helper instead of dispatching them to other views.
	 * @defaultValue false
	 */
	"android-consume-hover-event"?: boolean | null;
	/**
	 * Allow the iOS drawing path to display asynchronously.
	 * @defaultValue true; text defaults to false.
	 */
	"async-display"?: boolean | null;
	/** Enable cross-language attribute setting on the Harmony ArkUI node. */
	"enable-cross-language-option"?: boolean | null;
	/**
	 * Enable the new animator implementation for this element.
	 * @defaultValue false
	 */
	"enable-new-animator"?: boolean | null;
	/**
	 * Render the Android view into a hardware texture layer.
	 * @defaultValue false
	 */
	"hardware-layer"?: boolean | null;
	/**
	 * Fall back to directional focus traversal when the explicitly configured next-focus target cannot be focused.
	 * @defaultValue false
	 */
	"next-focus-fallback"?: boolean | null;
	/** The unique identifier of the element, ensuring the uniqueness of the entire page */
	id?: string | null;
	/**
	 * Element display, All elements is displayed by Default
	 * @deprecated Please sse `visibility:hidden` instead
	 */
	hidden?: boolean | null;
	/** Animation Properties */
	animation?: {
		actions: {
			[key: string]: unknown;
		}[];
	} | null;
	/**
	 * Used to flatten the specified element, avoiding the creation of a real renderObject to accelerate rendering performance. Its default value is true on `<view>`
	 * @defaultValue true
	 */
	flatten?: boolean | null;
	/**
	 * The unique identifier of the element, used for the client to find the View
	 * @deprecated Please use `id` instead
	 */
	name?: string | null;
	/**
	 * Used to control overlapRendering on Android
	 * @defaultValue false
	 */
	overlap?: boolean | null;
	/**
	 * Controls whether to overlap the drawing of the background and content to achieve the correct alpha blend effect
	 * @defaultValue false
	 */
	"overlap-ios"?: boolean | null;
	/**
	 * Layout only
	 * @deprecated Legacy API
	 */
	enableLayoutOnly?: boolean | null;
	/**
	 * Legacy API
	 * @deprecated Legacy API
	 */
	cssAlignWithLegacyW3C?: boolean | null;
	/** Accessibility reading content */
	"accessibility-label"?: string | null;
	/**
	 * The combination of accessibility traits that best characterizes the accessibility element.
	 * @defaultValue 'none'
	 */
	"accessibility-traits"?:
		| "text"
		| "image"
		| "button"
		| "link"
		| "header"
		| "search"
		| "selected"
		| "playable"
		| "keyboard"
		| "summary"
		| "disabled"
		| "updating"
		| "adjustable"
		| "tabbar"
		| "none"
		| null;
	/** A Boolean value that indicates whether the element is an accessibility element that an assistive app can access. */
	"accessibility-element"?: boolean | null;
	/** A localized string that contains the value of the accessibility element. */
	"accessibility-value"?: string | null;
	/**
	 * Sets whether the node represents a heading.
	 * @defaultValue false
	 */
	"accessibility-heading"?: boolean | null;
	/** Sets the class this node comes from, or, sets the custom role description. */
	"accessibility-role-description"?: string | null;
	/** The custom actions of the current accessibility element. */
	"accessibility-actions"?: string[] | null;
	/**
	 * Whether the element is hidden from the accessibility tree.
	 * @defaultValue false
	 */
	"accessibility-elements-hidden"?: boolean | null;
	/**
	 * Whether the element is the only focusable element in the accessibility tree.
	 * @defaultValue false
	 */
	"accessibility-exclusive-focus"?: boolean | null;
	/** Used to specify the accessibility identifier of a UIView in iOS, which is only required when accessing the platform accessibility framework. */
	"ios-platform-accessibility-id"?: string | null;
	/**
	 * Direction used to start pan gesture interception. 0 means horizontal, and 1 means vertical.
	 * @defaultValue undefined
	 */
	"pan-intercept-direction"?: 0 | 1 | null;
	/**
	 * Scope used to decide which external gesture views can be intercepted. 0 means self, 1 means ancestors, 2 means descendants, 3 means self and ancestors, 4 means self and descendants, and 5 means all.
	 * @defaultValue undefined
	 */
	"pan-intercept-scope"?: 0 | 1 | 2 | 3 | 4 | 5 | null;
	/**
	 * UIGestureRecognizer's class name, used with `ios-pan-intercept-view-class` and `ios-pan-intercept-view-tag` to identify an external gesture that should be intercepted by pan-intercept.
	 * @defaultValue undefined
	 */
	"ios-pan-intercept-gesture-class"?: string | null;
	/**
	 * UIView's class name, used with `ios-pan-intercept-gesture-class` and `ios-pan-intercept-view-tag` to identify the view bound to an external gesture that should be intercepted by pan-intercept.
	 * @defaultValue undefined
	 */
	"ios-pan-intercept-view-class"?: string | null;
	/**
	 * UIView's tag, used with `ios-pan-intercept-gesture-class` and `ios-pan-intercept-view-class` to identify the view bound to an external gesture that should be intercepted by pan-intercept.
	 * @defaultValue undefined
	 */
	"ios-pan-intercept-view-tag"?: number | null;
	/**
	 * Control whether the component can receive focus
	 * @defaultValue false
	 */
	focusable?: boolean | null;
	/**
	 * Use two-dimensional coordinates such as "0, 0" to represent the focus priority of the x and y axes respectively. Nodes with the same priority will switch focus based on their position.
	 * @defaultValue '0, 0'
	 */
	"focus-index"?: string | null;
	/**
	 * Manually specify the node ID that will receive focus when the user presses the "up" arrow key
	 * @defaultValue ''
	 */
	"next-focus-up"?: string | null;
	/**
	 * Manually specify the node ID that will receive focus when the user presses the "down" arrow key
	 * @defaultValue ''
	 */
	"next-focus-down"?: string | null;
	/**
	 * Manually specify the node ID that will receive focus when the user presses the "left" arrow key
	 * @defaultValue ''
	 */
	"next-focus-left"?: string | null;
	/**
	 * Manually specify the node id that receives focus when the user presses the "right" arrow key
	 * @defaultValue ''
	 */
	"next-focus-right"?: string | null;
	/** Custom timing flag */
	__lynx_timing_flag?: string | null;
	/**
	 * We use CAShapeLayer to accelerate rendering of the component's backgrounds on iOS.
	 * @deprecated CPU drawing path is no longer needed
	 * @defaultValue true
	 */
	"ios-background-shape-layer"?: boolean | null;
	/** Use CAShapeLayer for background rendering. When omitted, the native background configuration applies. */
	"background-shape-layer"?: boolean | null;
	/** Specify whether the node needs exposure/un-exposure events */
	"exposure-id"?: string | null;
	/** Specify the scene of the node that needs exposure/un-exposure events */
	"exposure-scene"?: string | null;
	/**
	 * Specify the top extension value of the screen boundary referenced by the target node in the exposure detection task, which affects the viewport intersection judgment of the target node. Each node can have its own screen boundary scaling value
	 * @defaultValue "0px"
	 */
	"exposure-screen-margin-top"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the right extension value of the screen boundary referenced by the target node in the exposure detection task, which affects the viewport intersection judgment of the target node. Each node can have its own screen boundary scaling value
	 * @defaultValue "0px"
	 */
	"exposure-screen-margin-right"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the bottom extension value of the screen boundary referenced by the target node in the exposure detection task, which affects the viewport intersection judgment of the target node. Each node can have its own screen boundary scaling value
	 * @defaultValue "0px"
	 */
	"exposure-screen-margin-bottom"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the left extension value of the screen boundary referenced by the target node in the exposure detection task, which affects the viewport intersection judgment of the target node. Each node can have its own screen boundary scaling value
	 * @defaultValue "0px"
	 */
	"exposure-screen-margin-left"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the top boundary extension value of the target node itself in the exposure detection, which affects the viewport intersection judgment of the target node. Each node can have its own boundary extension value. Before using this feature, you also need to set `enable-exposure-ui-margin` for the current node.
	 * @defaultValue "0px"
	 */
	"exposure-ui-margin-top"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the right boundary extension value of the target node itself in the exposure detection, which affects the viewport intersection judgment of the target node. Each node can have its own boundary extension value. Before using this feature, you also need to set `enable-exposure-ui-margin` for the current node.
	 * @defaultValue "0px"
	 */
	"exposure-ui-margin-right"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the bottom boundary extension value of the target node itself in the exposure detection, which affects the viewport intersection judgment of the target node. Each node can have its own boundary extension value. Before using this feature, you also need to set `enable-exposure-ui-margin` for the current node.
	 * @defaultValue "0px"
	 */
	"exposure-ui-margin-bottom"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specify the left boundary extension value of the target node itself in the exposure detection, which affects the viewport intersection judgment of the target node. Each node can have its own boundary extension value. Before using this feature, you also need to set `enable-exposure-ui-margin` for the current node.
	 * @defaultValue "0px"
	 */
	"exposure-ui-margin-left"?: `${number}px` | `${number}rpx` | null;
	/**
	 * Specifies the viewport intersection ratio at which the target node can trigger an exposure event. An exposure event is triggered when the ratio is greater than this value, and an un-exposure event is triggered when the ratio is less than this value. By default, the exposure event is triggered as soon as the target node is visible.
	 * @defaultValue "0%"
	 */
	"exposure-area"?: `${number}%` | null;
	/**
	 * Specifies whether the target node needs to extend the viewport intersection area for exposure detection. If set to true, the target node will be extended by the values specified in `exposure-ui-margin-top`, `exposure-ui-margin-right`, `exposure-ui-margin-bottom`, and `exposure-ui-margin-left`. The default value is `true` on Harmony
	 * @defaultValue false
	 */
	"enable-exposure-ui-margin"?: boolean | null;
	/**
	 * Specify whether the exposure detection task takes into account the viewport clipping of the parent node. When set to true, nodes outside the parent node viewport cannot trigger exposure, and when set to false, nodes outside the parent node viewport can trigger exposure.
	 * @defaultValue false
	 */
	"enable-exposure-ui-clip"?: boolean | null;
	/**
	 * Specifies whether the target node and its child nodes can respond to Lynx touch events. This property does not affect platform gestures (such as scrolling of the `<scroll-view>`)
	 * @defaultValue true
	 */
	"user-interaction-enabled"?: boolean | null;
	/** Specifies whether the target node and its child nodes can consume platform touch events. This property does not affect platform gestures (such as scrolling of the `<scroll-view>`). The default value is `true` on iOS and Harmony and `false` on Android. */
	"native-interaction-enabled"?: boolean | null;
	/**
	 * Specifies whether the target node blocks platform gestures outside Lynx when it is on the event response chain, which can achieve an effect like blocking the platform swipe-back gesture.
	 * @defaultValue false
	 */
	"block-native-event"?: boolean | null;
	/** Specifies whether to block platform gestures outside Lynx when the target node is on the event response chain and the touch is within the specified area of the target node. This can achieve an effect similar to blocking the platform swipe-back gesture. The inner array is an array containing four numbers: x, y, width, and height, representing the position of the touch area within the target node. */
	"block-native-event-areas"?:
		| [
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
		  ][]
		| null;
	/** Specifies whether the platform gestures should respond when the target node is on the event response chain and a swipe occurs at a specific angle. This does not affect Lynx touch events and can be used to implement a front - end scroll container that consumes swipes in a specified direction. The inner array contains two numbers, start and end, representing the start and end angles respectively. */
	"consume-slide-event"?: [number, number][] | null;
	/**
	 * Specifies whether the platform touch events should be dispatched to Lynx when the touch occurs on the target node. This can achieve an effect similar to displaying content without interaction. This property supports inheritance. This property can only ensure that Lynx does not consume platform touch events, but the parent view of LynxView may consume touch events, causing the penetration effect to fail.
	 * @defaultValue false
	 */
	"event-through"?: boolean | null;
	/**
	 * Specifies whether the target node supports the :active pseudo-class to continue bubbling up the event response chain when a touch event occurs.
	 * @defaultValue false
	 */
	"enable-touch-pseudo-propagation"?: boolean | null;
	/**
	 * Specify the touch event response hot zone of the target node without affecting platform gestures
	 * @defaultValue "0px"
	 */
	"hit-slop"?:
		| `${number}px`
		| {
				top: `${number}px`;
				left: `${number}px`;
				right: `${number}px`;
				bottom: `${number}px`;
		  }
		| null;
	/**
	 * Specifies whether the target node should not抢占 focus when touched. By default, the node will抢占 focus when clicked, which can achieve an effect similar to preventing the keyboard from closing when clicking other areas. Additionally, it supports inheritance, meaning the default value of child nodes is the `ignore-focus` value of the parent node, and child nodes can override this value.
	 * @defaultValue false
	 */
	"ignore-focus"?: boolean | null;
	/**
	 * Specifies whether to force the triggering of touch events when the target node is on the event response chain, which can solve the problem of touch events not being triggered on iOS
	 * @defaultValue false
	 */
	"ios-enable-simultaneous-touch"?: boolean | null;
	/** Used in conjunction with `event-through` to specify the event penetration definition for the target node in specific areas. The inner array is in the form of [x, y, width, height], with units of px or %. The x/y positions are relative to the viewport coordinate system of the target node. */
	"event-through-active-regions"?:
		| [
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
				`${number}px` | `${number}%`,
		  ][]
		| null;
	/** Listening for background image loading success. */
	onbgload?: LynxEventHandler<LynxImageLoadEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgload`, heard in the capture phase: before the elements inside. */
	onbgloadcapture?: LynxEventHandler<LynxImageLoadEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgload`, caught here: the elements this is inside do not hear it. */
	oncatchbgload?: LynxEventHandler<LynxImageLoadEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgload`, caught in the capture phase: the elements inside do not hear it. */
	oncatchbgloadcapture?: LynxEventHandler<LynxImageLoadEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgload`, in a main-thread function. */
	"main-thread:onbgload"?: MainThreadEventHandler<LynxImageLoadEvent<MainThread.Element>>;
	/** `bgload`, in a main-thread function, in the capture phase. */
	"main-thread:onbgloadcapture"?: MainThreadEventHandler<LynxImageLoadEvent<MainThread.Element>>;
	/** `bgload`, in a main-thread function, caught here. */
	"main-thread:oncatchbgload"?: MainThreadEventHandler<LynxImageLoadEvent<MainThread.Element>>;
	/** `bgload`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchbgloadcapture"?: MainThreadEventHandler<
		LynxImageLoadEvent<MainThread.Element>
	>;
	/** Failed to load background image for listening. */
	onbgerror?: LynxEventHandler<LynxImageErrorEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgerror`, heard in the capture phase: before the elements inside. */
	onbgerrorcapture?: LynxEventHandler<LynxImageErrorEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgerror`, caught here: the elements this is inside do not hear it. */
	oncatchbgerror?: LynxEventHandler<LynxImageErrorEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgerror`, caught in the capture phase: the elements inside do not hear it. */
	oncatchbgerrorcapture?: LynxEventHandler<LynxImageErrorEvent<LynxNode, LynxNode<Tag>>>;
	/** `bgerror`, in a main-thread function. */
	"main-thread:onbgerror"?: MainThreadEventHandler<LynxImageErrorEvent<MainThread.Element>>;
	/** `bgerror`, in a main-thread function, in the capture phase. */
	"main-thread:onbgerrorcapture"?: MainThreadEventHandler<LynxImageErrorEvent<MainThread.Element>>;
	/** `bgerror`, in a main-thread function, caught here. */
	"main-thread:oncatchbgerror"?: MainThreadEventHandler<LynxImageErrorEvent<MainThread.Element>>;
	/** `bgerror`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchbgerrorcapture"?: MainThreadEventHandler<
		LynxImageErrorEvent<MainThread.Element>
	>;
	/** Finger touch action begins. */
	ontouchstart?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchstart`, heard in the capture phase: before the elements inside. */
	ontouchstartcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchstart`, caught here: the elements this is inside do not hear it. */
	oncatchtouchstart?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchstart`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtouchstartcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchstart`, in a main-thread function. */
	"main-thread:ontouchstart"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchstart`, in a main-thread function, in the capture phase. */
	"main-thread:ontouchstartcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchstart`, in a main-thread function, caught here. */
	"main-thread:oncatchtouchstart"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchstart`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtouchstartcapture"?: MainThreadEventHandler<
		LynxTouchEvent<MainThread.Element>
	>;
	/** Moving after touching with fingers. */
	ontouchmove?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchmove`, heard in the capture phase: before the elements inside. */
	ontouchmovecapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchmove`, caught here: the elements this is inside do not hear it. */
	oncatchtouchmove?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchmove`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtouchmovecapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchmove`, in a main-thread function. */
	"main-thread:ontouchmove"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchmove`, in a main-thread function, in the capture phase. */
	"main-thread:ontouchmovecapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchmove`, in a main-thread function, caught here. */
	"main-thread:oncatchtouchmove"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchmove`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtouchmovecapture"?: MainThreadEventHandler<
		LynxTouchEvent<MainThread.Element>
	>;
	/** Finger touch actions are interrupted by incoming call reminders and pop-up windows. */
	ontouchcancel?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchcancel`, heard in the capture phase: before the elements inside. */
	ontouchcancelcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchcancel`, caught here: the elements this is inside do not hear it. */
	oncatchtouchcancel?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchcancel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtouchcancelcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchcancel`, in a main-thread function. */
	"main-thread:ontouchcancel"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchcancel`, in a main-thread function, in the capture phase. */
	"main-thread:ontouchcancelcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchcancel`, in a main-thread function, caught here. */
	"main-thread:oncatchtouchcancel"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchcancel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtouchcancelcapture"?: MainThreadEventHandler<
		LynxTouchEvent<MainThread.Element>
	>;
	/** Finger touch action ends. */
	ontouchend?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchend`, heard in the capture phase: before the elements inside. */
	ontouchendcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchend`, caught here: the elements this is inside do not hear it. */
	oncatchtouchend?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchend`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtouchendcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `touchend`, in a main-thread function. */
	"main-thread:ontouchend"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchend`, in a main-thread function, in the capture phase. */
	"main-thread:ontouchendcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchend`, in a main-thread function, caught here. */
	"main-thread:oncatchtouchend"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `touchend`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtouchendcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** A pointer becomes active over the element. */
	onpointerdown?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerdown`, heard in the capture phase: before the elements inside. */
	onpointerdowncapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerdown`, caught here: the elements this is inside do not hear it. */
	oncatchpointerdown?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerdown`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointerdowncapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerdown`, in a main-thread function. */
	"main-thread:onpointerdown"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerdown`, in a main-thread function, in the capture phase. */
	"main-thread:onpointerdowncapture"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerdown`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerdown"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerdown`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointerdowncapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** An active pointer changes coordinates. */
	onpointermove?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointermove`, heard in the capture phase: before the elements inside. */
	onpointermovecapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointermove`, caught here: the elements this is inside do not hear it. */
	oncatchpointermove?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointermove`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointermovecapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointermove`, in a main-thread function. */
	"main-thread:onpointermove"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointermove`, in a main-thread function, in the capture phase. */
	"main-thread:onpointermovecapture"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointermove`, in a main-thread function, caught here. */
	"main-thread:oncatchpointermove"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointermove`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointermovecapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** A pointer is no longer active. */
	onpointerup?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerup`, heard in the capture phase: before the elements inside. */
	onpointerupcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerup`, caught here: the elements this is inside do not hear it. */
	oncatchpointerup?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerup`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointerupcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerup`, in a main-thread function. */
	"main-thread:onpointerup"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerup`, in a main-thread function, in the capture phase. */
	"main-thread:onpointerupcapture"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerup`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerup"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerup`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointerupcapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** An active pointer is canceled. */
	onpointercancel?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointercancel`, heard in the capture phase: before the elements inside. */
	onpointercancelcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointercancel`, caught here: the elements this is inside do not hear it. */
	oncatchpointercancel?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointercancel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointercancelcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointercancel`, in a main-thread function. */
	"main-thread:onpointercancel"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointercancel`, in a main-thread function, in the capture phase. */
	"main-thread:onpointercancelcapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** `pointercancel`, in a main-thread function, caught here. */
	"main-thread:oncatchpointercancel"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointercancel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointercancelcapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** A pointer enters the element or one of its descendants. */
	onpointerover?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerover`, heard in the capture phase: before the elements inside. */
	onpointerovercapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerover`, caught here: the elements this is inside do not hear it. */
	oncatchpointerover?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerover`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointerovercapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerover`, in a main-thread function. */
	"main-thread:onpointerover"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerover`, in a main-thread function, in the capture phase. */
	"main-thread:onpointerovercapture"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerover`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerover"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerover`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointerovercapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** A pointer enters the element. */
	onpointerenter?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerenter`, heard in the capture phase: before the elements inside. */
	onpointerentercapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerenter`, caught here: the elements this is inside do not hear it. */
	oncatchpointerenter?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerenter`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointerentercapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerenter`, in a main-thread function. */
	"main-thread:onpointerenter"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerenter`, in a main-thread function, in the capture phase. */
	"main-thread:onpointerentercapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** `pointerenter`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerenter"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerenter`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointerentercapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** A pointer leaves the element or enters one of its descendants. */
	onpointerout?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerout`, heard in the capture phase: before the elements inside. */
	onpointeroutcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerout`, caught here: the elements this is inside do not hear it. */
	oncatchpointerout?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerout`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointeroutcapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerout`, in a main-thread function. */
	"main-thread:onpointerout"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerout`, in a main-thread function, in the capture phase. */
	"main-thread:onpointeroutcapture"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerout`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerout"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerout`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointeroutcapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** A pointer leaves the element. */
	onpointerleave?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerleave`, heard in the capture phase: before the elements inside. */
	onpointerleavecapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerleave`, caught here: the elements this is inside do not hear it. */
	oncatchpointerleave?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerleave`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpointerleavecapture?: LynxEventHandler<LynxPointerEvent<LynxNode, LynxNode<Tag>>>;
	/** `pointerleave`, in a main-thread function. */
	"main-thread:onpointerleave"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerleave`, in a main-thread function, in the capture phase. */
	"main-thread:onpointerleavecapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** `pointerleave`, in a main-thread function, caught here. */
	"main-thread:oncatchpointerleave"?: MainThreadEventHandler<LynxPointerEvent<MainThread.Element>>;
	/** `pointerleave`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpointerleavecapture"?: MainThreadEventHandler<
		LynxPointerEvent<MainThread.Element>
	>;
	/** After touching the finger, if it leaves after more than 350ms and the event callback function is specified and triggered, the tap event will not be triggered. */
	onlongpress?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longpress`, heard in the capture phase: before the elements inside. */
	onlongpresscapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longpress`, caught here: the elements this is inside do not hear it. */
	oncatchlongpress?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longpress`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlongpresscapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longpress`, in a main-thread function. */
	"main-thread:onlongpress"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longpress`, in a main-thread function, in the capture phase. */
	"main-thread:onlongpresscapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longpress`, in a main-thread function, caught here. */
	"main-thread:oncatchlongpress"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longpress`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlongpresscapture"?: MainThreadEventHandler<
		LynxTouchEvent<MainThread.Element>
	>;
	/** It will trigger during a transition animation start. */
	ontransitionstart?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionstart`, heard in the capture phase: before the elements inside. */
	ontransitionstartcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionstart`, caught here: the elements this is inside do not hear it. */
	oncatchtransitionstart?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionstart`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtransitionstartcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionstart`, in a main-thread function. */
	"main-thread:ontransitionstart"?: MainThreadEventHandler<LynxTransitionEvent<MainThread.Element>>;
	/** `transitionstart`, in a main-thread function, in the capture phase. */
	"main-thread:ontransitionstartcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitionstart`, in a main-thread function, caught here. */
	"main-thread:oncatchtransitionstart"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitionstart`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtransitionstartcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** It will trigger when a transition animation is canceled. */
	ontransitioncancel?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitioncancel`, heard in the capture phase: before the elements inside. */
	ontransitioncancelcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitioncancel`, caught here: the elements this is inside do not hear it. */
	oncatchtransitioncancel?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitioncancel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtransitioncancelcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitioncancel`, in a main-thread function. */
	"main-thread:ontransitioncancel"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitioncancel`, in a main-thread function, in the capture phase. */
	"main-thread:ontransitioncancelcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitioncancel`, in a main-thread function, caught here. */
	"main-thread:oncatchtransitioncancel"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitioncancel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtransitioncancelcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** It will trigger after the transition or createAnimation animation is finished. */
	ontransitionend?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionend`, heard in the capture phase: before the elements inside. */
	ontransitionendcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionend`, caught here: the elements this is inside do not hear it. */
	oncatchtransitionend?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionend`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtransitionendcapture?: LynxEventHandler<LynxTransitionEvent<LynxNode, LynxNode<Tag>>>;
	/** `transitionend`, in a main-thread function. */
	"main-thread:ontransitionend"?: MainThreadEventHandler<LynxTransitionEvent<MainThread.Element>>;
	/** `transitionend`, in a main-thread function, in the capture phase. */
	"main-thread:ontransitionendcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitionend`, in a main-thread function, caught here. */
	"main-thread:oncatchtransitionend"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** `transitionend`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtransitionendcapture"?: MainThreadEventHandler<
		LynxTransitionEvent<MainThread.Element>
	>;
	/** It will trigger at the beginning of an animation. */
	onanimationstart?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationstart`, heard in the capture phase: before the elements inside. */
	onanimationstartcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationstart`, caught here: the elements this is inside do not hear it. */
	oncatchanimationstart?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationstart`, caught in the capture phase: the elements inside do not hear it. */
	oncatchanimationstartcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationstart`, in a main-thread function. */
	"main-thread:onanimationstart"?: MainThreadEventHandler<LynxAnimationEvent<MainThread.Element>>;
	/** `animationstart`, in a main-thread function, in the capture phase. */
	"main-thread:onanimationstartcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationstart`, in a main-thread function, caught here. */
	"main-thread:oncatchanimationstart"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationstart`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchanimationstartcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** It will trigger during an animation iteration. */
	onanimationiteration?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationiteration`, heard in the capture phase: before the elements inside. */
	onanimationiterationcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationiteration`, caught here: the elements this is inside do not hear it. */
	oncatchanimationiteration?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationiteration`, caught in the capture phase: the elements inside do not hear it. */
	oncatchanimationiterationcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationiteration`, in a main-thread function. */
	"main-thread:onanimationiteration"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationiteration`, in a main-thread function, in the capture phase. */
	"main-thread:onanimationiterationcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationiteration`, in a main-thread function, caught here. */
	"main-thread:oncatchanimationiteration"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationiteration`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchanimationiterationcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** It will trigger when an animation is canceled. */
	onanimationcancel?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationcancel`, heard in the capture phase: before the elements inside. */
	onanimationcancelcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationcancel`, caught here: the elements this is inside do not hear it. */
	oncatchanimationcancel?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationcancel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchanimationcancelcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationcancel`, in a main-thread function. */
	"main-thread:onanimationcancel"?: MainThreadEventHandler<LynxAnimationEvent<MainThread.Element>>;
	/** `animationcancel`, in a main-thread function, in the capture phase. */
	"main-thread:onanimationcancelcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationcancel`, in a main-thread function, caught here. */
	"main-thread:oncatchanimationcancel"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationcancel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchanimationcancelcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** It will trigger upon completion of an animation. */
	onanimationend?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationend`, heard in the capture phase: before the elements inside. */
	onanimationendcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationend`, caught here: the elements this is inside do not hear it. */
	oncatchanimationend?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationend`, caught in the capture phase: the elements inside do not hear it. */
	oncatchanimationendcapture?: LynxEventHandler<LynxAnimationEvent<LynxNode, LynxNode<Tag>>>;
	/** `animationend`, in a main-thread function. */
	"main-thread:onanimationend"?: MainThreadEventHandler<LynxAnimationEvent<MainThread.Element>>;
	/** `animationend`, in a main-thread function, in the capture phase. */
	"main-thread:onanimationendcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationend`, in a main-thread function, caught here. */
	"main-thread:oncatchanimationend"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** `animationend`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchanimationendcapture"?: MainThreadEventHandler<
		LynxAnimationEvent<MainThread.Element>
	>;
	/** Indicates that a mouse button (primary or secondary) is pressed. The target is the UI that contains the mouse pointer and is closest to the user. */
	onmousedown?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedown`, heard in the capture phase: before the elements inside. */
	onmousedowncapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedown`, caught here: the elements this is inside do not hear it. */
	oncatchmousedown?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedown`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmousedowncapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedown`, in a main-thread function. */
	"main-thread:onmousedown"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedown`, in a main-thread function, in the capture phase. */
	"main-thread:onmousedowncapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedown`, in a main-thread function, caught here. */
	"main-thread:oncatchmousedown"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedown`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmousedowncapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Indicates that a mouse button (primary or secondary) is released. The target is the UI that contains the mouse pointer and is closest to the user. */
	onmouseup?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseup`, heard in the capture phase: before the elements inside. */
	onmouseupcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseup`, caught here: the elements this is inside do not hear it. */
	oncatchmouseup?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseup`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmouseupcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseup`, in a main-thread function. */
	"main-thread:onmouseup"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseup`, in a main-thread function, in the capture phase. */
	"main-thread:onmouseupcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseup`, in a main-thread function, caught here. */
	"main-thread:oncatchmouseup"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseup`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmouseupcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** Mouse movement. */
	onmousemove?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousemove`, heard in the capture phase: before the elements inside. */
	onmousemovecapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousemove`, caught here: the elements this is inside do not hear it. */
	oncatchmousemove?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousemove`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmousemovecapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousemove`, in a main-thread function. */
	"main-thread:onmousemove"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousemove`, in a main-thread function, in the capture phase. */
	"main-thread:onmousemovecapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousemove`, in a main-thread function, caught here. */
	"main-thread:oncatchmousemove"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousemove`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmousemovecapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Indicates that a pointing device is moved onto the element. */
	onmouseenter?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseenter`, heard in the capture phase: before the elements inside. */
	onmouseentercapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseenter`, caught here: the elements this is inside do not hear it. */
	oncatchmouseenter?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseenter`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmouseentercapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseenter`, in a main-thread function. */
	"main-thread:onmouseenter"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseenter`, in a main-thread function, in the capture phase. */
	"main-thread:onmouseentercapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseenter`, in a main-thread function, caught here. */
	"main-thread:oncatchmouseenter"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseenter`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmouseentercapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Indicates that a pointing device is moved off the element. */
	onmouseleave?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseleave`, heard in the capture phase: before the elements inside. */
	onmouseleavecapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseleave`, caught here: the elements this is inside do not hear it. */
	oncatchmouseleave?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseleave`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmouseleavecapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseleave`, in a main-thread function. */
	"main-thread:onmouseleave"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseleave`, in a main-thread function, in the capture phase. */
	"main-thread:onmouseleavecapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseleave`, in a main-thread function, caught here. */
	"main-thread:oncatchmouseleave"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseleave`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmouseleavecapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Mouse click. */
	onmouseclick?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseclick`, heard in the capture phase: before the elements inside. */
	onmouseclickcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseclick`, caught here: the elements this is inside do not hear it. */
	oncatchmouseclick?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseclick`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmouseclickcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouseclick`, in a main-thread function. */
	"main-thread:onmouseclick"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseclick`, in a main-thread function, in the capture phase. */
	"main-thread:onmouseclickcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseclick`, in a main-thread function, caught here. */
	"main-thread:oncatchmouseclick"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouseclick`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmouseclickcapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Double-click the mouse. */
	onmousedblclick?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedblclick`, heard in the capture phase: before the elements inside. */
	onmousedblclickcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedblclick`, caught here: the elements this is inside do not hear it. */
	oncatchmousedblclick?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedblclick`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmousedblclickcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mousedblclick`, in a main-thread function. */
	"main-thread:onmousedblclick"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedblclick`, in a main-thread function, in the capture phase. */
	"main-thread:onmousedblclickcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedblclick`, in a main-thread function, caught here. */
	"main-thread:oncatchmousedblclick"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mousedblclick`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmousedblclickcapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Long press on the mouse. */
	onmouselongpress?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouselongpress`, heard in the capture phase: before the elements inside. */
	onmouselongpresscapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouselongpress`, caught here: the elements this is inside do not hear it. */
	oncatchmouselongpress?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouselongpress`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmouselongpresscapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `mouselongpress`, in a main-thread function. */
	"main-thread:onmouselongpress"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouselongpress`, in a main-thread function, in the capture phase. */
	"main-thread:onmouselongpresscapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** `mouselongpress`, in a main-thread function, caught here. */
	"main-thread:oncatchmouselongpress"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `mouselongpress`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmouselongpresscapture"?: MainThreadEventHandler<
		LynxMouseEvent<MainThread.Element>
	>;
	/** Mouse (or touchpad) scrolling. */
	onwheel?: LynxEventHandler<LynxWheelEvent<LynxNode, LynxNode<Tag>>>;
	/** `wheel`, heard in the capture phase: before the elements inside. */
	onwheelcapture?: LynxEventHandler<LynxWheelEvent<LynxNode, LynxNode<Tag>>>;
	/** `wheel`, caught here: the elements this is inside do not hear it. */
	oncatchwheel?: LynxEventHandler<LynxWheelEvent<LynxNode, LynxNode<Tag>>>;
	/** `wheel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchwheelcapture?: LynxEventHandler<LynxWheelEvent<LynxNode, LynxNode<Tag>>>;
	/** `wheel`, in a main-thread function. */
	"main-thread:onwheel"?: MainThreadEventHandler<LynxWheelEvent<MainThread.Element>>;
	/** `wheel`, in a main-thread function, in the capture phase. */
	"main-thread:onwheelcapture"?: MainThreadEventHandler<LynxWheelEvent<MainThread.Element>>;
	/** `wheel`, in a main-thread function, caught here. */
	"main-thread:oncatchwheel"?: MainThreadEventHandler<LynxWheelEvent<MainThread.Element>>;
	/** `wheel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchwheelcapture"?: MainThreadEventHandler<LynxWheelEvent<MainThread.Element>>;
	/** Zoom gesture in the trackpaad */
	onzoom?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `zoom`, heard in the capture phase: before the elements inside. */
	onzoomcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `zoom`, caught here: the elements this is inside do not hear it. */
	oncatchzoom?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `zoom`, caught in the capture phase: the elements inside do not hear it. */
	oncatchzoomcapture?: LynxEventHandler<LynxMouseEvent<LynxNode, LynxNode<Tag>>>;
	/** `zoom`, in a main-thread function. */
	"main-thread:onzoom"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `zoom`, in a main-thread function, in the capture phase. */
	"main-thread:onzoomcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `zoom`, in a main-thread function, caught here. */
	"main-thread:oncatchzoom"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** `zoom`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchzoomcapture"?: MainThreadEventHandler<LynxMouseEvent<MainThread.Element>>;
	/** Keyboard (or remote control) button pressed. */
	onkeydown?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keydown`, heard in the capture phase: before the elements inside. */
	onkeydowncapture?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keydown`, caught here: the elements this is inside do not hear it. */
	oncatchkeydown?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keydown`, caught in the capture phase: the elements inside do not hear it. */
	oncatchkeydowncapture?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keydown`, in a main-thread function. */
	"main-thread:onkeydown"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keydown`, in a main-thread function, in the capture phase. */
	"main-thread:onkeydowncapture"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keydown`, in a main-thread function, caught here. */
	"main-thread:oncatchkeydown"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keydown`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchkeydowncapture"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** Keyboard (or remote control) key released. */
	onkeyup?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keyup`, heard in the capture phase: before the elements inside. */
	onkeyupcapture?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keyup`, caught here: the elements this is inside do not hear it. */
	oncatchkeyup?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keyup`, caught in the capture phase: the elements inside do not hear it. */
	oncatchkeyupcapture?: LynxEventHandler<LynxKeyEvent<LynxNode, LynxNode<Tag>>>;
	/** `keyup`, in a main-thread function. */
	"main-thread:onkeyup"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keyup`, in a main-thread function, in the capture phase. */
	"main-thread:onkeyupcapture"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keyup`, in a main-thread function, caught here. */
	"main-thread:oncatchkeyup"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** `keyup`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchkeyupcapture"?: MainThreadEventHandler<LynxKeyEvent<MainThread.Element>>;
	/** Layout info changed event */
	onlayoutchange?: LynxEventHandler<LynxLayoutChangeEvent<LynxNode, LynxNode<Tag>>>;
	/** `layoutchange`, heard in the capture phase: before the elements inside. */
	onlayoutchangecapture?: LynxEventHandler<LynxLayoutChangeEvent<LynxNode, LynxNode<Tag>>>;
	/** `layoutchange`, caught here: the elements this is inside do not hear it. */
	oncatchlayoutchange?: LynxEventHandler<LynxLayoutChangeEvent<LynxNode, LynxNode<Tag>>>;
	/** `layoutchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlayoutchangecapture?: LynxEventHandler<LynxLayoutChangeEvent<LynxNode, LynxNode<Tag>>>;
	/** `layoutchange`, in a main-thread function. */
	"main-thread:onlayoutchange"?: MainThreadEventHandler<LynxLayoutChangeEvent<MainThread.Element>>;
	/** `layoutchange`, in a main-thread function, in the capture phase. */
	"main-thread:onlayoutchangecapture"?: MainThreadEventHandler<
		LynxLayoutChangeEvent<MainThread.Element>
	>;
	/** `layoutchange`, in a main-thread function, caught here. */
	"main-thread:oncatchlayoutchange"?: MainThreadEventHandler<
		LynxLayoutChangeEvent<MainThread.Element>
	>;
	/** `layoutchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlayoutchangecapture"?: MainThreadEventHandler<
		LynxLayoutChangeEvent<MainThread.Element>
	>;
	/** Element appear event */
	onuiappear?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uiappear`, heard in the capture phase: before the elements inside. */
	onuiappearcapture?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uiappear`, caught here: the elements this is inside do not hear it. */
	oncatchuiappear?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uiappear`, caught in the capture phase: the elements inside do not hear it. */
	oncatchuiappearcapture?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uiappear`, in a main-thread function. */
	"main-thread:onuiappear"?: MainThreadEventHandler<LynxUIAppearanceEvent<MainThread.Element>>;
	/** `uiappear`, in a main-thread function, in the capture phase. */
	"main-thread:onuiappearcapture"?: MainThreadEventHandler<
		LynxUIAppearanceEvent<MainThread.Element>
	>;
	/** `uiappear`, in a main-thread function, caught here. */
	"main-thread:oncatchuiappear"?: MainThreadEventHandler<LynxUIAppearanceEvent<MainThread.Element>>;
	/** `uiappear`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchuiappearcapture"?: MainThreadEventHandler<
		LynxUIAppearanceEvent<MainThread.Element>
	>;
	/** Element disappear event */
	onuidisappear?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uidisappear`, heard in the capture phase: before the elements inside. */
	onuidisappearcapture?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uidisappear`, caught here: the elements this is inside do not hear it. */
	oncatchuidisappear?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uidisappear`, caught in the capture phase: the elements inside do not hear it. */
	oncatchuidisappearcapture?: LynxEventHandler<LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>>;
	/** `uidisappear`, in a main-thread function. */
	"main-thread:onuidisappear"?: MainThreadEventHandler<LynxUIAppearanceEvent<MainThread.Element>>;
	/** `uidisappear`, in a main-thread function, in the capture phase. */
	"main-thread:onuidisappearcapture"?: MainThreadEventHandler<
		LynxUIAppearanceEvent<MainThread.Element>
	>;
	/** `uidisappear`, in a main-thread function, caught here. */
	"main-thread:oncatchuidisappear"?: MainThreadEventHandler<
		LynxUIAppearanceEvent<MainThread.Element>
	>;
	/** `uidisappear`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchuidisappearcapture"?: MainThreadEventHandler<
		LynxUIAppearanceEvent<MainThread.Element>
	>;
	/** The custom actions of the current accessibility element is triggered. */
	onaccessibilityaction?: LynxEventHandler<LynxAccessibilityActionEvent<LynxNode, LynxNode<Tag>>>;
	/** `accessibilityaction`, heard in the capture phase: before the elements inside. */
	onaccessibilityactioncapture?: LynxEventHandler<
		LynxAccessibilityActionEvent<LynxNode, LynxNode<Tag>>
	>;
	/** `accessibilityaction`, caught here: the elements this is inside do not hear it. */
	oncatchaccessibilityaction?: LynxEventHandler<
		LynxAccessibilityActionEvent<LynxNode, LynxNode<Tag>>
	>;
	/** `accessibilityaction`, caught in the capture phase: the elements inside do not hear it. */
	oncatchaccessibilityactioncapture?: LynxEventHandler<
		LynxAccessibilityActionEvent<LynxNode, LynxNode<Tag>>
	>;
	/** `accessibilityaction`, in a main-thread function. */
	"main-thread:onaccessibilityaction"?: MainThreadEventHandler<
		LynxAccessibilityActionEvent<MainThread.Element>
	>;
	/** `accessibilityaction`, in a main-thread function, in the capture phase. */
	"main-thread:onaccessibilityactioncapture"?: MainThreadEventHandler<
		LynxAccessibilityActionEvent<MainThread.Element>
	>;
	/** `accessibilityaction`, in a main-thread function, caught here. */
	"main-thread:oncatchaccessibilityaction"?: MainThreadEventHandler<
		LynxAccessibilityActionEvent<MainThread.Element>
	>;
	/** `accessibilityaction`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchaccessibilityactioncapture"?: MainThreadEventHandler<
		LynxAccessibilityActionEvent<MainThread.Element>
	>;
	/** Triggered when a finger clicks on the touch plane. This event and the `longpress` event are mutually exclusive in event listening. That is, if the front-end listens to both events simultaneously, the two events will not be triggered at the same time, and the `longpress` event takes precedence. */
	ontap?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `tap`, heard in the capture phase: before the elements inside. */
	ontapcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `tap`, caught here: the elements this is inside do not hear it. */
	oncatchtap?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `tap`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtapcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `tap`, in a main-thread function. */
	"main-thread:ontap"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `tap`, in a main-thread function, in the capture phase. */
	"main-thread:ontapcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `tap`, in a main-thread function, caught here. */
	"main-thread:oncatchtap"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `tap`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtapcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/**
	 * After touching the finger, leave after more than 350ms
	 * @deprecated It is recommended to use the longpress event instead
	 */
	onlongtap?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longtap`, heard in the capture phase: before the elements inside. */
	onlongtapcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longtap`, caught here: the elements this is inside do not hear it. */
	oncatchlongtap?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longtap`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlongtapcapture?: LynxEventHandler<LynxTouchEvent<LynxNode, LynxNode<Tag>>>;
	/** `longtap`, in a main-thread function. */
	"main-thread:onlongtap"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longtap`, in a main-thread function, in the capture phase. */
	"main-thread:onlongtapcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longtap`, in a main-thread function, caught here. */
	"main-thread:oncatchlongtap"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
	/** `longtap`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlongtapcapture"?: MainThreadEventHandler<LynxTouchEvent<MainThread.Element>>;
}

/** The events every element sends, by name, as its listeners hear them. */
export interface LynxCommonEvents<Tag extends string = string> {
	/** Listening for background image loading success. */
	bgload: LynxImageLoadEvent<LynxNode, LynxNode<Tag>>;
	/** Failed to load background image for listening. */
	bgerror: LynxImageErrorEvent<LynxNode, LynxNode<Tag>>;
	/** Finger touch action begins. */
	touchstart: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/** Moving after touching with fingers. */
	touchmove: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/** Finger touch actions are interrupted by incoming call reminders and pop-up windows. */
	touchcancel: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/** Finger touch action ends. */
	touchend: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer becomes active over the element. */
	pointerdown: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** An active pointer changes coordinates. */
	pointermove: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer is no longer active. */
	pointerup: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** An active pointer is canceled. */
	pointercancel: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer enters the element or one of its descendants. */
	pointerover: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer enters the element. */
	pointerenter: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer leaves the element or enters one of its descendants. */
	pointerout: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** A pointer leaves the element. */
	pointerleave: LynxPointerEvent<LynxNode, LynxNode<Tag>>;
	/** After touching the finger, if it leaves after more than 350ms and the event callback function is specified and triggered, the tap event will not be triggered. */
	longpress: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger during a transition animation start. */
	transitionstart: LynxTransitionEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger when a transition animation is canceled. */
	transitioncancel: LynxTransitionEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger after the transition or createAnimation animation is finished. */
	transitionend: LynxTransitionEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger at the beginning of an animation. */
	animationstart: LynxAnimationEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger during an animation iteration. */
	animationiteration: LynxAnimationEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger when an animation is canceled. */
	animationcancel: LynxAnimationEvent<LynxNode, LynxNode<Tag>>;
	/** It will trigger upon completion of an animation. */
	animationend: LynxAnimationEvent<LynxNode, LynxNode<Tag>>;
	/** Indicates that a mouse button (primary or secondary) is pressed. The target is the UI that contains the mouse pointer and is closest to the user. */
	mousedown: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Indicates that a mouse button (primary or secondary) is released. The target is the UI that contains the mouse pointer and is closest to the user. */
	mouseup: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Mouse movement. */
	mousemove: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Indicates that a pointing device is moved onto the element. */
	mouseenter: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Indicates that a pointing device is moved off the element. */
	mouseleave: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Mouse click. */
	mouseclick: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Double-click the mouse. */
	mousedblclick: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Long press on the mouse. */
	mouselongpress: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Mouse (or touchpad) scrolling. */
	wheel: LynxWheelEvent<LynxNode, LynxNode<Tag>>;
	/** Zoom gesture in the trackpaad */
	zoom: LynxMouseEvent<LynxNode, LynxNode<Tag>>;
	/** Keyboard (or remote control) button pressed. */
	keydown: LynxKeyEvent<LynxNode, LynxNode<Tag>>;
	/** Keyboard (or remote control) key released. */
	keyup: LynxKeyEvent<LynxNode, LynxNode<Tag>>;
	/** Layout info changed event */
	layoutchange: LynxLayoutChangeEvent<LynxNode, LynxNode<Tag>>;
	/** Element appear event */
	uiappear: LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>;
	/** Element disappear event */
	uidisappear: LynxUIAppearanceEvent<LynxNode, LynxNode<Tag>>;
	/** The custom actions of the current accessibility element is triggered. */
	accessibilityaction: LynxAccessibilityActionEvent<LynxNode, LynxNode<Tag>>;
	/** Triggered when a finger clicks on the touch plane. This event and the `longpress` event are mutually exclusive in event listening. That is, if the front-end listens to both events simultaneously, the two events will not be triggered at the same time, and the `longpress` event takes precedence. */
	tap: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
	/**
	 * After touching the finger, leave after more than 350ms
	 * @deprecated It is recommended to use the longpress event instead
	 */
	longtap: LynxTouchEvent<LynxNode, LynxNode<Tag>>;
}

/**
 * The attributes and events most elements have as written here, and a few have their own of
 * (`<input>`'s `focus` and `blur`).
 */
export interface LynxDefaultAttributes<Tag extends string = string> {
	/** Element gets focus. */
	onfocus?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `focus`, heard in the capture phase: before the elements inside. */
	onfocuscapture?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `focus`, caught here: the elements this is inside do not hear it. */
	oncatchfocus?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `focus`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfocuscapture?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `focus`, in a main-thread function. */
	"main-thread:onfocus"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, in the capture phase. */
	"main-thread:onfocuscapture"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught here. */
	"main-thread:oncatchfocus"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfocuscapture"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** Element loses focus. */
	onblur?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `blur`, heard in the capture phase: before the elements inside. */
	onblurcapture?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `blur`, caught here: the elements this is inside do not hear it. */
	oncatchblur?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `blur`, caught in the capture phase: the elements inside do not hear it. */
	oncatchblurcapture?: LynxEventHandler<LynxCommonEvent<LynxNode, LynxNode<Tag>>>;
	/** `blur`, in a main-thread function. */
	"main-thread:onblur"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, in the capture phase. */
	"main-thread:onblurcapture"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught here. */
	"main-thread:oncatchblur"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchblurcapture"?: MainThreadEventHandler<LynxCommonEvent<MainThread.Element>>;
}

/** The events of `LynxDefaultAttributes`, by name, as their listeners hear them. */
export interface LynxDefaultEvents<Tag extends string = string> {
	/** Element gets focus. */
	focus: LynxCommonEvent<LynxNode, LynxNode<Tag>>;
	/** Element loses focus. */
	blur: LynxCommonEvent<LynxNode, LynxNode<Tag>>;
}

/** The attributes and events of `<component>`. */
export interface LynxComponentAttributes
	extends LynxCommonAttributes<"component">, LynxDefaultAttributes<"component"> {
	/** Component name */
	is?: string | null;
}

/** The events `<component>` sends, by name, as its listeners hear them. */
export interface LynxComponentEvents
	extends LynxCommonEvents<"component">, LynxDefaultEvents<"component"> {}

/** The attributes and events of `<filter-image>`. */
export interface LynxFilterImageAttributes
	extends LynxCommonAttributes<"filter-image">, LynxDefaultAttributes<"filter-image"> {
	/**
	 * Supports http/https/base64
	 * @defaultValue ""
	 */
	src?: string | null;
	/**
	 * Specifies image cropping/scaling mode
	 * scaleToFill: Scales the image without preserving the aspect ratio, stretching the image to fill the element
	 * aspectFit: Scales the image while preserving aspect ratio so that the long side is fully visible
	 * aspectFill: Scales the image while preserving aspect ratio, ensuring the short side fills the element
	 * center: Does not scale the image; image is centered
	 * @defaultValue "scaleToFill"
	 */
	mode?: "center" | "scaleToFill" | "aspectFit" | "aspectFill" | null;
	/**
	 * Specifies the BoxBlur radius for the image
	 * @defaultValue "0px"
	 */
	"blur-radius"?: string | null;
	/**
	 * Specifies the shadow style for the image
	 * @defaultValue ""
	 */
	"drop-shadow"?: string | null;
	/** Image load success event */
	onload?: LynxEventHandler<LynxFilterImageLoadEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `load`, heard in the capture phase: before the elements inside. */
	onloadcapture?: LynxEventHandler<LynxFilterImageLoadEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `load`, caught here: the elements this is inside do not hear it. */
	oncatchload?: LynxEventHandler<LynxFilterImageLoadEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `load`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloadcapture?: LynxEventHandler<
		LynxFilterImageLoadEvent<LynxNode, LynxNode<"filter-image">>
	>;
	/** `load`, in a main-thread function. */
	"main-thread:onload"?: MainThreadEventHandler<LynxFilterImageLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, in the capture phase. */
	"main-thread:onloadcapture"?: MainThreadEventHandler<
		LynxFilterImageLoadEvent<MainThread.Element>
	>;
	/** `load`, in a main-thread function, caught here. */
	"main-thread:oncatchload"?: MainThreadEventHandler<LynxFilterImageLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloadcapture"?: MainThreadEventHandler<
		LynxFilterImageLoadEvent<MainThread.Element>
	>;
	/** Image load error event */
	onerror?: LynxEventHandler<LynxFilterImageErrorEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxFilterImageErrorEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxFilterImageErrorEvent<LynxNode, LynxNode<"filter-image">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<
		LynxFilterImageErrorEvent<LynxNode, LynxNode<"filter-image">>
	>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxFilterImageErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<
		LynxFilterImageErrorEvent<MainThread.Element>
	>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<
		LynxFilterImageErrorEvent<MainThread.Element>
	>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<
		LynxFilterImageErrorEvent<MainThread.Element>
	>;
}

/** The events `<filter-image>` sends, by name, as its listeners hear them. */
export interface LynxFilterImageEvents
	extends LynxCommonEvents<"filter-image">, LynxDefaultEvents<"filter-image"> {
	/** Image load success event */
	load: LynxFilterImageLoadEvent<LynxNode, LynxNode<"filter-image">>;
	/** Image load error event */
	error: LynxFilterImageErrorEvent<LynxNode, LynxNode<"filter-image">>;
}

/** The attributes and events of `<image>`. */
export interface LynxImageAttributes
	extends LynxCommonAttributes<"image">, LynxDefaultAttributes<"image"> {
	/**
	 * Supports http/https/base64
	 * @defaultValue undefined
	 */
	src?: string | null;
	/**
	 * Specifies image cropping/scaling mode
	 * `scaleToFill`: Scales the image without preserving the aspect ratio, stretching the image to fill the element.
	 * `aspectFit`: Scales the image while preserving aspect ratio so that the long side is fully visible.
	 * `aspectFill`: Scales the image while preserving aspect ratio, ensuring the short side fills the element.
	 * `center`: Does not scale the image; image is centered.
	 * @defaultValue 'scaleToFill'
	 */
	mode?: "center" | "scaleToFill" | "aspectFit" | "aspectFill" | null;
	/**
	 * `ARGB_8888`: 32-bit memory per pixel, supports semi-transparent images.
	 * `RGB_565`: 16-bit memory per pixel, reduces memory usage but loses transparency.
	 *
	 * Support PC platform since 3.5
	 *
	 * :::note
	 *
	 * Affects the actual memory usage of the image bitmap.
	 *
	 * Taking an image with a resolution of 1024*768 as an example, the actual memory usage is (1024 * 768 * bits per pixel / 8) Bytes.
	 *
	 * The default is ARGB_8888. Frontend developers can optimize image memory usage by setting it to RGB_565.
	 *
	 * `ARGB_8888`: Each pixel occupies 32 bits of memory and includes an alpha channel.
	 * `RGB_565`: Each pixel occupies 16 bits of memory, which reduces memory usage but results in the loss of transparency.
	 *
	 * Setting RGB_565 may affect the display of `<image>`'s border-radius. You can set border-radius on the parent view of the `<image>` and add the clip-radius attribute to the parent view.
	 *
	 * It is not recommended to use RGB_565 when mode="aspectFit", as it may cause black borders in the cropped area.
	 *
	 * :::
	 * @defaultValue "ARGB_8888"
	 */
	"image-config"?: "ARGB_8888" | "RGB_565" | null;
	/** Placeholder image, used same as src */
	placeholder?: string | null;
	/** Image blur radius */
	"blur-radius"?: string | null;
	/**
	 * Stretchable area for 9patch images, in percentage or decimal, four values for top, right, bottom, left
	 *
	 * :::note
	 * Using cap-insets does not require the original image to be a 9-patch image.
	 * :::
	 */
	"cap-insets"?: string | null;
	/**
	 * Adjust the scale of stretchable area for 9patch images
	 * @defaultValue 1
	 */
	"cap-insets-scale"?: number | null;
	/**
	 * Number of times an animated image plays, 0 stands for infinite
	 * @defaultValue 0
	 */
	"loop-count"?: number | null;
	/**
	 * Image won't load if its size is 0, but will load if prefetch-width is set
	 * @defaultValue "0px"
	 * @deprecated
	 */
	"prefetch-width"?: string | null;
	/**
	 * Image won't load if its size is 0, but will load if prefetch-height is set
	 * @defaultValue "0px"
	 * @deprecated
	 */
	"prefetch-height"?: string | null;
	/**
	 * When set to true and the `<image>` element has no width or height,
	 * the size of the `<image>` will be automatically adjusted
	 * to match the image's original dimensions after the image is successfully loaded,
	 * ensuring that the aspect ratio is maintained.
	 * @defaultValue false
	 */
	"auto-size"?: boolean | null;
	/**
	 * When set to true, the `<image>` will only clear the previously displayed image resource after a new image has successfully loaded.
	 * The default behavior is to clear the image resource before starting a new load.
	 * This can resolve flickering issues when the image src is switched and reloaded. It is not recommended to enable this in scenarios where there is node reuse in views like lists.
	 * @defaultValue false
	 */
	"defer-src-invalidation"?: boolean | null;
	/**
	 * Specifies whether the animated image should start playing automatically once it is loaded.
	 * @defaultValue true
	 */
	autoplay?: boolean | null;
	/** Changes the color of all non-transparent pixels to the tint-color specified. The value is a `<color>`. */
	"tint-color"?: string | null;
	/** Image load success event */
	onload?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"image">>>;
	/** `load`, heard in the capture phase: before the elements inside. */
	onloadcapture?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"image">>>;
	/** `load`, caught here: the elements this is inside do not hear it. */
	oncatchload?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"image">>>;
	/** `load`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloadcapture?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"image">>>;
	/** `load`, in a main-thread function. */
	"main-thread:onload"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, in the capture phase. */
	"main-thread:onloadcapture"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught here. */
	"main-thread:oncatchload"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloadcapture"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** Image load error event */
	onerror?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"image">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"image">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"image">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"image">>>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** Triggered when the animated image starts playing. */
	onstartplay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `startplay`, heard in the capture phase: before the elements inside. */
	onstartplaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `startplay`, caught here: the elements this is inside do not hear it. */
	oncatchstartplay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `startplay`, caught in the capture phase: the elements inside do not hear it. */
	oncatchstartplaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `startplay`, in a main-thread function. */
	"main-thread:onstartplay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, in the capture phase. */
	"main-thread:onstartplaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, caught here. */
	"main-thread:oncatchstartplay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchstartplaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Triggered when one loop of the animated image finishes playing. */
	oncurrentloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `currentloopcomplete`, heard in the capture phase: before the elements inside. */
	oncurrentloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `currentloopcomplete`, caught here: the elements this is inside do not hear it. */
	oncatchcurrentloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `currentloopcomplete`, caught in the capture phase: the elements inside do not hear it. */
	oncatchcurrentloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `currentloopcomplete`, in a main-thread function. */
	"main-thread:oncurrentloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `currentloopcomplete`, in a main-thread function, in the capture phase. */
	"main-thread:oncurrentloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
	/** `currentloopcomplete`, in a main-thread function, caught here. */
	"main-thread:oncatchcurrentloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `currentloopcomplete`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchcurrentloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
	/** Triggered when the animated image finishes playing all `loop-count` loops. If `loop-count` is not set, this callback will not be triggered. */
	onfinalloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `finalloopcomplete`, heard in the capture phase: before the elements inside. */
	onfinalloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `finalloopcomplete`, caught here: the elements this is inside do not hear it. */
	oncatchfinalloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `finalloopcomplete`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfinalloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"image">>>;
	/** `finalloopcomplete`, in a main-thread function. */
	"main-thread:onfinalloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, in the capture phase. */
	"main-thread:onfinalloopcompletecapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, caught here. */
	"main-thread:oncatchfinalloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfinalloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
}

/** The events `<image>` sends, by name, as its listeners hear them. */
export interface LynxImageEvents extends LynxCommonEvents<"image">, LynxDefaultEvents<"image"> {
	/** Image load success event */
	load: LynxLoadEvent<LynxNode, LynxNode<"image">>;
	/** Image load error event */
	error: LynxErrorEvent<LynxNode, LynxNode<"image">>;
	/** Triggered when the animated image starts playing. */
	startplay: LynxEvent<LynxNode, LynxNode<"image">>;
	/** Triggered when one loop of the animated image finishes playing. */
	currentloopcomplete: LynxEvent<LynxNode, LynxNode<"image">>;
	/** Triggered when the animated image finishes playing all `loop-count` loops. If `loop-count` is not set, this callback will not be triggered. */
	finalloopcomplete: LynxEvent<LynxNode, LynxNode<"image">>;
}

/** The attributes and events of `<inline-image>`. */
export interface LynxInlineImageAttributes
	extends LynxCommonAttributes<"inline-image">, LynxDefaultAttributes<"inline-image"> {
	/**
	 * Supports http/https/base64
	 * @defaultValue undefined
	 */
	src?: string | null;
	/**
	 * Specifies image cropping/scaling mode
	 * `scaleToFill`: Scales the image without preserving the aspect ratio, stretching the image to fill the element.
	 * `aspectFit`: Scales the image while preserving aspect ratio so that the long side is fully visible.
	 * `aspectFill`: Scales the image while preserving aspect ratio, ensuring the short side fills the element.
	 * `center`: Does not scale the image; image is centered.
	 * @defaultValue 'scaleToFill'
	 */
	mode?: "center" | "scaleToFill" | "aspectFit" | "aspectFill" | null;
	/**
	 * `ARGB_8888`: 32-bit memory per pixel, supports semi-transparent images.
	 * `RGB_565`: 16-bit memory per pixel, reduces memory usage but loses transparency.
	 *
	 * Support PC platform since 3.5
	 *
	 * :::note
	 *
	 * Affects the actual memory usage of the image bitmap.
	 *
	 * Taking an image with a resolution of 1024*768 as an example, the actual memory usage is (1024 * 768 * bits per pixel / 8) Bytes.
	 *
	 * The default is ARGB_8888. Frontend developers can optimize image memory usage by setting it to RGB_565.
	 *
	 * `ARGB_8888`: Each pixel occupies 32 bits of memory and includes an alpha channel.
	 * `RGB_565`: Each pixel occupies 16 bits of memory, which reduces memory usage but results in the loss of transparency.
	 *
	 * Setting RGB_565 may affect the display of `<image>`'s border-radius. You can set border-radius on the parent view of the `<image>` and add the clip-radius attribute to the parent view.
	 *
	 * It is not recommended to use RGB_565 when mode="aspectFit", as it may cause black borders in the cropped area.
	 *
	 * :::
	 * @defaultValue "ARGB_8888"
	 */
	"image-config"?: "ARGB_8888" | "RGB_565" | null;
	/** Placeholder image, used same as src */
	placeholder?: string | null;
	/** Image blur radius */
	"blur-radius"?: string | null;
	/**
	 * Stretchable area for 9patch images, in percentage or decimal, four values for top, right, bottom, left
	 *
	 * :::note
	 * Using cap-insets does not require the original image to be a 9-patch image.
	 * :::
	 */
	"cap-insets"?: string | null;
	/**
	 * Adjust the scale of stretchable area for 9patch images
	 * @defaultValue 1
	 */
	"cap-insets-scale"?: number | null;
	/**
	 * Number of times an animated image plays, 0 stands for infinite
	 * @defaultValue 0
	 */
	"loop-count"?: number | null;
	/**
	 * Image won't load if its size is 0, but will load if prefetch-width is set
	 * @defaultValue "0px"
	 * @deprecated
	 */
	"prefetch-width"?: string | null;
	/**
	 * Image won't load if its size is 0, but will load if prefetch-height is set
	 * @defaultValue "0px"
	 * @deprecated
	 */
	"prefetch-height"?: string | null;
	/**
	 * When set to true and the `<image>` element has no width or height,
	 * the size of the `<image>` will be automatically adjusted
	 * to match the image's original dimensions after the image is successfully loaded,
	 * ensuring that the aspect ratio is maintained.
	 * @defaultValue false
	 */
	"auto-size"?: boolean | null;
	/**
	 * When set to true, the `<image>` will only clear the previously displayed image resource after a new image has successfully loaded.
	 * The default behavior is to clear the image resource before starting a new load.
	 * This can resolve flickering issues when the image src is switched and reloaded. It is not recommended to enable this in scenarios where there is node reuse in views like lists.
	 * @defaultValue false
	 */
	"defer-src-invalidation"?: boolean | null;
	/**
	 * Specifies whether the animated image should start playing automatically once it is loaded.
	 * @defaultValue true
	 */
	autoplay?: boolean | null;
	/** Changes the color of all non-transparent pixels to the tint-color specified. The value is a `<color>`. */
	"tint-color"?: string | null;
	/**
	 * Shift text or an inline image vertically relative to the text baseline. Positive values move it down.
	 * A px string is converted to device pixels, a percentage is relative to font size,
	 * and a unitless string is a font-size multiplier.
	 * For text, an explicit zero string still selects custom baseline alignment.
	 * @defaultValue Unset; the stored shift is 0 and no custom text baseline alignment is applied.
	 */
	"custom-baseline-shift"?: string | null;
	/** Image load success event */
	onload?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `load`, heard in the capture phase: before the elements inside. */
	onloadcapture?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `load`, caught here: the elements this is inside do not hear it. */
	oncatchload?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `load`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloadcapture?: LynxEventHandler<LynxLoadEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `load`, in a main-thread function. */
	"main-thread:onload"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, in the capture phase. */
	"main-thread:onloadcapture"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught here. */
	"main-thread:oncatchload"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloadcapture"?: MainThreadEventHandler<LynxLoadEvent<MainThread.Element>>;
	/** Image load error event */
	onerror?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<LynxErrorEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<LynxErrorEvent<MainThread.Element>>;
	/** Triggered when the animated image starts playing. */
	onstartplay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `startplay`, heard in the capture phase: before the elements inside. */
	onstartplaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `startplay`, caught here: the elements this is inside do not hear it. */
	oncatchstartplay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `startplay`, caught in the capture phase: the elements inside do not hear it. */
	oncatchstartplaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `startplay`, in a main-thread function. */
	"main-thread:onstartplay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, in the capture phase. */
	"main-thread:onstartplaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, caught here. */
	"main-thread:oncatchstartplay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `startplay`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchstartplaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Triggered when one loop of the animated image finishes playing. */
	oncurrentloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `currentloopcomplete`, heard in the capture phase: before the elements inside. */
	oncurrentloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `currentloopcomplete`, caught here: the elements this is inside do not hear it. */
	oncatchcurrentloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `currentloopcomplete`, caught in the capture phase: the elements inside do not hear it. */
	oncatchcurrentloopcompletecapture?: LynxEventHandler<
		LynxEvent<LynxNode, LynxNode<"inline-image">>
	>;
	/** `currentloopcomplete`, in a main-thread function. */
	"main-thread:oncurrentloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `currentloopcomplete`, in a main-thread function, in the capture phase. */
	"main-thread:oncurrentloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
	/** `currentloopcomplete`, in a main-thread function, caught here. */
	"main-thread:oncatchcurrentloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `currentloopcomplete`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchcurrentloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
	/** Triggered when the animated image finishes playing all `loop-count` loops. If `loop-count` is not set, this callback will not be triggered. */
	onfinalloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `finalloopcomplete`, heard in the capture phase: before the elements inside. */
	onfinalloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `finalloopcomplete`, caught here: the elements this is inside do not hear it. */
	oncatchfinalloopcomplete?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `finalloopcomplete`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfinalloopcompletecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"inline-image">>>;
	/** `finalloopcomplete`, in a main-thread function. */
	"main-thread:onfinalloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, in the capture phase. */
	"main-thread:onfinalloopcompletecapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, caught here. */
	"main-thread:oncatchfinalloopcomplete"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `finalloopcomplete`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfinalloopcompletecapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
}

/** The events `<inline-image>` sends, by name, as its listeners hear them. */
export interface LynxInlineImageEvents
	extends LynxCommonEvents<"inline-image">, LynxDefaultEvents<"inline-image"> {
	/** Image load success event */
	load: LynxLoadEvent<LynxNode, LynxNode<"inline-image">>;
	/** Image load error event */
	error: LynxErrorEvent<LynxNode, LynxNode<"inline-image">>;
	/** Triggered when the animated image starts playing. */
	startplay: LynxEvent<LynxNode, LynxNode<"inline-image">>;
	/** Triggered when one loop of the animated image finishes playing. */
	currentloopcomplete: LynxEvent<LynxNode, LynxNode<"inline-image">>;
	/** Triggered when the animated image finishes playing all `loop-count` loops. If `loop-count` is not set, this callback will not be triggered. */
	finalloopcomplete: LynxEvent<LynxNode, LynxNode<"inline-image">>;
}

/** The attributes and events of `<inline-text>`. */
export interface LynxInlineTextAttributes
	extends LynxCommonAttributes<"inline-text">, LynxDefaultAttributes<"inline-text"> {
	/**
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Background color of selected text, encoded as a 32-bit ARGB number.
	 */
	"selection-background-color"?: number | null;
	/**
	 * Clay Android and Clay Harmony support begins in prerelease builds; the corresponding stable releases omit this API.
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Color of the text selection handles. Use a numeric ARGB color on native mobile platforms; Clay additionally accepts color strings.
	 */
	"selection-handle-color"?: string | number | null;
	/**
	 * Clay Android and Clay Harmony support begins in prerelease builds; the corresponding stable releases omit this API.
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Size of the text selection handle. Android uses physical pixels; iOS and Harmony use logical units.
	 * Omitted values and zero follow each platform's native defaults.
	 */
	"selection-handle-size"?: number | null;
	/** Maximum number of lines for text display */
	"text-maxline"?: string | null;
	/**
	 * Maximum number of characters for text display
	 * @deprecated Suggest preprocessing the text content length.
	 */
	"text-maxlength"?: string | null;
	/**
	 * Whether font-size is affected by system font scaling
	 * @defaultValue false
	 * @deprecated
	 */
	"enable-font-scaling"?: boolean | null;
	/**
	 * Baseline adjustment strategy in vertical direction; note: setting this value does not guarantee text centering
	 * @defaultValue ""
	 * @deprecated Use the text-single-line-vertical-align attribute instead.
	 */
	"text-vertical-align"?: "center" | "top" | "bottom" | null;
	/**
	 * By default, if text truncation occurs, the color of the inserted ... will be specified by the style on the nearest inline-text. If this attribute is enabled, the color of ... will be specified by the style on the outermost text tag.
	 * @defaultValue false
	 */
	"tail-color-convert"?: boolean | null;
	/**
	 * Set single-line plain text to be centered and aligned within the line. Inline text settings are not supported. Recommended only when the default font doesn't meet center alignment needs, as it increases text measurement time.
	 * @defaultValue 'normal'
	 */
	"text-single-line-vertical-align"?: "normal" | "center" | "top" | "bottom" | null;
	/**
	 * Enable additional spacing above and below the text on Android; recommended only in high language scenarios to avoid text truncation.
	 * @defaultValue false
	 */
	"include-font-padding"?: boolean | null;
	/**
	 * Enable support for Emoji2 adaptation; requires androidx.emoji2 dependency.
	 * @defaultValue false
	 */
	"android-emoji-compat"?: boolean | null;
	/**
	 * Enables fake bold for fonts when the default bold is not found.
	 * @defaultValue false
	 */
	"text-fake-bold"?: boolean | null;
	/**
	 * Sets whether to enable text selection.
	 * @defaultValue false
	 */
	"text-selection"?: boolean | null;
	/**
	 * Used to set whether to turn on the custom pop-up context menu after selection and copying. It takes effect after enabling text-selection.
	 * @defaultValue false
	 */
	"custom-context-menu"?: boolean | null;
	/**
	 * Used to set whether to enable the custom text selection function. When it is enabled, the element will no longer handle the gesture logic related to selection and copying. It takes effect after enabling text-selection.
	 * @defaultValue false
	 */
	"custom-text-selection"?: boolean | null;
	/**
	 * Shift text or an inline image vertically relative to the text baseline. Positive values move it down.
	 * A px string is converted to device pixels, a percentage is relative to font size,
	 * and a unitless string is a font-size multiplier.
	 * For text, an explicit zero string still selects custom baseline alignment.
	 * @defaultValue Unset; the stored shift is 0 and no custom text baseline alignment is applied.
	 */
	"custom-baseline-shift"?: string | null;
	/** Text layout event */
	onlayout?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"inline-text">>>;
	/** `layout`, heard in the capture phase: before the elements inside. */
	onlayoutcapture?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"inline-text">>>;
	/** `layout`, caught here: the elements this is inside do not hear it. */
	oncatchlayout?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"inline-text">>>;
	/** `layout`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlayoutcapture?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"inline-text">>>;
	/** `layout`, in a main-thread function. */
	"main-thread:onlayout"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, in the capture phase. */
	"main-thread:onlayoutcapture"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, caught here. */
	"main-thread:oncatchlayout"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlayoutcapture"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** Text selection change event */
	onselectionchange?: LynxEventHandler<LynxSelectionChangeEvent<LynxNode, LynxNode<"inline-text">>>;
	/** `selectionchange`, heard in the capture phase: before the elements inside. */
	onselectionchangecapture?: LynxEventHandler<
		LynxSelectionChangeEvent<LynxNode, LynxNode<"inline-text">>
	>;
	/** `selectionchange`, caught here: the elements this is inside do not hear it. */
	oncatchselectionchange?: LynxEventHandler<
		LynxSelectionChangeEvent<LynxNode, LynxNode<"inline-text">>
	>;
	/** `selectionchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchselectionchangecapture?: LynxEventHandler<
		LynxSelectionChangeEvent<LynxNode, LynxNode<"inline-text">>
	>;
	/** `selectionchange`, in a main-thread function. */
	"main-thread:onselectionchange"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, in the capture phase. */
	"main-thread:onselectionchangecapture"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught here. */
	"main-thread:oncatchselectionchange"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchselectionchangecapture"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
}

/** The events `<inline-text>` sends, by name, as its listeners hear them. */
export interface LynxInlineTextEvents
	extends LynxCommonEvents<"inline-text">, LynxDefaultEvents<"inline-text"> {
	/** Text layout event */
	layout: LynxLayoutEvent<LynxNode, LynxNode<"inline-text">>;
	/** Text selection change event */
	selectionchange: LynxSelectionChangeEvent<LynxNode, LynxNode<"inline-text">>;
}

/** The attributes and events of `<inline-truncation>`. */
export interface LynxInlineTruncationAttributes extends LynxElementAttributes<"inline-truncation"> {}

/** The events `<inline-truncation>` sends, by name, as its listeners hear them. */
export interface LynxInlineTruncationEvents {}

/** The attributes and events of `<list>`. */
export interface LynxListAttributes
	extends LynxCommonAttributes<"list">, LynxDefaultAttributes<"list"> {
	/**
	 * Sets the scrolling direction and layout direction.
	 * @defaultValue 'vertical'
	 */
	"scroll-orientation"?: "horizontal" | "vertical" | null;
	/**
	 * The number of columns or rows for the list, and only effective when list-type is 'flow' or 'waterfall'.
	 * @defaultValue 1
	 */
	"span-count"?: number | null;
	/**
	 * layout type of the list
	 * @defaultValue 'single'
	 */
	"list-type"?: "single" | "flow" | "waterfall" | null;
	/**
	 * Whether to allow scrolling for a list.
	 * @defaultValue true
	 */
	"enable-scroll"?: boolean | null;
	/**
	 * Indicates whether list can achieve nested scrolling with other scrollable containers. When enabled, the inner container scrolls first, followed by the outer container.
	 * @defaultValue false
	 */
	"enable-nested-scroll"?: boolean | null;
	/**
	 * Declared on the list to control whether the list as a whole is allowed to be sticky at the top or bottom.
	 * @defaultValue false
	 */
	sticky?: boolean | null;
	/**
	 * The offset distance from the top or bottom of list for sticky positioning, in px.
	 * @defaultValue 0
	 */
	"sticky-offset"?: number | null;
	/**
	 * Control whether list should produce bounces effect when scrolling past its content boundaries.
	 * @defaultValue true
	 */
	bounces?: boolean | null;
	/**
	 * Specifies the node position to which list automatically scrolls after rendering.
	 * @defaultValue 0
	 */
	"initial-scroll-index"?: number | null;
	/**
	 * Controls whether the scroll event callback parameters include the position information of the currently rendering node.
	 * @defaultValue false
	 */
	"need-visible-item-info"?: boolean | null;
	/**
	 * When scrolling down, when the number of remaining displayable child nodes at the bottom is first less than lower-threshold-item-count, a scrolltolower event is triggered. If lower-threshold-item-count is specified, lower-threshold is not effective.
	 * @defaultValue 0
	 */
	"lower-threshold-item-count"?: number | null;
	/**
	 * When scrolling up, when the number of remaining displayable child nodes at the top is first less than upper-threshold-item-count, a scrolltoupper event is triggered. If upper-threshold-item-count is specified, upper-threshold is not effective.
	 * @defaultValue 0
	 */
	"upper-threshold-item-count"?: number | null;
	/**
	 * Specify the callback frequency of the scroll event by passing in a value, which specifies how many milliseconds (ms) list will call the scroll callback event during scrolling.
	 * @defaultValue 200
	 */
	"scroll-event-throttle"?: number | null;
	/** Enable the paging effect, and after each scroll, the list-item will stop at a specified position. For list-type:single only. */
	"item-snap"?: LynxListItemSnapAlignment | null;
	/**
	 * Controls whether the layoutcomplete event includes the node layout information before and after this layout, and the list Diff information that triggered this layout, and the current list scroll state information.
	 * @defaultValue false
	 */
	"need-layout-complete-info"?: boolean | null;
	/**
	 * Used to mark the unique identifier for this data source update, which will be returned in the layoutcomplete event callback.
	 * @defaultValue -1
	 */
	"layout-id"?: number | null;
	/**
	 * This attribute controls the number of nodes outside list that are preloaded.
	 * @defaultValue 0
	 */
	"preload-buffer-count"?: number | null;
	/**
	 * Determine the strategy to search the reference anchor for removed on-screen children. If set to TO_START or TO_END, we will update reference anchor child for all removed on-screen children before consuming diff info. And in list layout pass, if no valid anchor child can be found from all on screen children, we use the reference anchor child in layout.
	 * @defaultValue ListSearchRefAnchorStrategy.NONE
	 */
	"experimental-search-ref-anchor-strategy"?: 0 | 1 | 2 | null;
	/**
	 * Whether to display the scroll bar of the list, with false on Harmony platform and true on other platforms.
	 * @defaultValue undefined
	 */
	"scroll-bar-enable"?: boolean | null;
	/**
	 * Whether to using operation from c++ list to insert list-item's platform view. The default value is false, but we recommend to set it to true in the case with MOST_ON_TASM or MULTI_THREAD thread strategy.
	 * @defaultValue false
	 */
	"enable-insert-platform-view-operation"?: boolean | null;
	/**
	 * When the content size of a component is smaller than the component itself, decide whether to enable scrolling.
	 * @defaultValue false
	 */
	"harmony-scroll-edge-effect"?: boolean | null;
	/**
	 * Selects the new C++ list update animation implementation. The selection is
	 * fixed by the first boolean value, or defaults to false before the first
	 * props update finishes. Batch rendering and parallel element flushing are
	 * not supported. Enable animations separately through the configuration.
	 * @defaultValue false
	 */
	"experimental-use-new-update-animation"?: boolean | null;
	/**
	 * Configures the new list update animation implementation. Disabling it or
	 * changing stages cancels pending and running animations; equivalent
	 * configurations preserve them. Legacy animations/durations stages remain
	 * supported alongside type/duration entries (since Lynx 4.4).
	 * When omitted, update animations are disabled.
	 * @defaultValue undefined
	 */
	"experimental-new-update-animation"?: LynxListUpdateAnimationConfig | null;
	/**
	 * Whether to display the scrollbar.
	 * @defaultValue false
	 */
	"enable-scrollbar"?: boolean | null;
	/**
	 * Whether to hide the scrollbar automatically when it is inactive.
	 * @defaultValue true
	 */
	"scroll-bar-auto-hide"?: boolean | null;
	/**
	 * Width of the scrollbar track, in px.
	 * @defaultValue 12
	 */
	"scroll-bar-width"?: number | null;
	/**
	 * Width of the scrollbar thumb, in px.
	 * @defaultValue 8
	 */
	"scroll-bar-thumb-width"?: number | null;
	/**
	 * Minimum length of the scrollbar thumb, in px.
	 * @defaultValue 18
	 */
	"scroll-bar-thumb-min-length"?: number | null;
	/**
	 * Corner radius of the scrollbar thumb, in px.
	 * @defaultValue 4
	 */
	"scroll-bar-thumb-radius"?: number | null;
	/**
	 * Color of the scrollbar thumb.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.4)'
	 */
	"scroll-bar-thumb-color"?: string | null;
	/**
	 * Color of the scrollbar thumb while it is being dragged.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.8)'
	 */
	"scroll-bar-thumb-active-color"?: string | null;
	/**
	 * Color of the scrollbar thumb while the pointer is hovering over it.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.8)'
	 */
	"scroll-bar-thumb-hover-color"?: string | null;
	/**
	 * Color of the scrollbar track.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'transparent'
	 */
	"scroll-bar-track-color"?: string | null;
	/**
	 * Delay before automatically hiding the scrollbar, in ms.
	 * @defaultValue 1000
	 */
	"scroll-bar-auto-hide-delay"?: number | null;
	/**
	 * The native list that draws it: `list-container` is Lynx's list that renders rows as it asks for them, which a deferred row needs.
	 *
	 * @workaround list-custom-list-name kind=lynx-gap delete-when="@lynx-js/types declares custom-list-name on <list>: remove it from scripts/types/additions.ts"
	 */
	"custom-list-name"?: string | null;
	/** Called when an animation type starts within a transaction. */
	onlistanimationstart?: LynxEventHandler<LynxListAnimationStartEvent<LynxNode, LynxNode<"list">>>;
	/** `listanimationstart`, heard in the capture phase: before the elements inside. */
	onlistanimationstartcapture?: LynxEventHandler<
		LynxListAnimationStartEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationstart`, caught here: the elements this is inside do not hear it. */
	oncatchlistanimationstart?: LynxEventHandler<
		LynxListAnimationStartEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationstart`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlistanimationstartcapture?: LynxEventHandler<
		LynxListAnimationStartEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationstart`, in a main-thread function. */
	"main-thread:onlistanimationstart"?: MainThreadEventHandler<
		LynxListAnimationStartEvent<MainThread.Element>
	>;
	/** `listanimationstart`, in a main-thread function, in the capture phase. */
	"main-thread:onlistanimationstartcapture"?: MainThreadEventHandler<
		LynxListAnimationStartEvent<MainThread.Element>
	>;
	/** `listanimationstart`, in a main-thread function, caught here. */
	"main-thread:oncatchlistanimationstart"?: MainThreadEventHandler<
		LynxListAnimationStartEvent<MainThread.Element>
	>;
	/** `listanimationstart`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlistanimationstartcapture"?: MainThreadEventHandler<
		LynxListAnimationStartEvent<MainThread.Element>
	>;
	/** Called when all participating items of an animation type finish normally. */
	onlistanimationend?: LynxEventHandler<LynxListAnimationEndEvent<LynxNode, LynxNode<"list">>>;
	/** `listanimationend`, heard in the capture phase: before the elements inside. */
	onlistanimationendcapture?: LynxEventHandler<
		LynxListAnimationEndEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationend`, caught here: the elements this is inside do not hear it. */
	oncatchlistanimationend?: LynxEventHandler<LynxListAnimationEndEvent<LynxNode, LynxNode<"list">>>;
	/** `listanimationend`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlistanimationendcapture?: LynxEventHandler<
		LynxListAnimationEndEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationend`, in a main-thread function. */
	"main-thread:onlistanimationend"?: MainThreadEventHandler<
		LynxListAnimationEndEvent<MainThread.Element>
	>;
	/** `listanimationend`, in a main-thread function, in the capture phase. */
	"main-thread:onlistanimationendcapture"?: MainThreadEventHandler<
		LynxListAnimationEndEvent<MainThread.Element>
	>;
	/** `listanimationend`, in a main-thread function, caught here. */
	"main-thread:oncatchlistanimationend"?: MainThreadEventHandler<
		LynxListAnimationEndEvent<MainThread.Element>
	>;
	/** `listanimationend`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlistanimationendcapture"?: MainThreadEventHandler<
		LynxListAnimationEndEvent<MainThread.Element>
	>;
	/** Called when a started, unfinished animation type is canceled. */
	onlistanimationcancel?: LynxEventHandler<
		LynxListAnimationCancelEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationcancel`, heard in the capture phase: before the elements inside. */
	onlistanimationcancelcapture?: LynxEventHandler<
		LynxListAnimationCancelEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationcancel`, caught here: the elements this is inside do not hear it. */
	oncatchlistanimationcancel?: LynxEventHandler<
		LynxListAnimationCancelEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationcancel`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlistanimationcancelcapture?: LynxEventHandler<
		LynxListAnimationCancelEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationcancel`, in a main-thread function. */
	"main-thread:onlistanimationcancel"?: MainThreadEventHandler<
		LynxListAnimationCancelEvent<MainThread.Element>
	>;
	/** `listanimationcancel`, in a main-thread function, in the capture phase. */
	"main-thread:onlistanimationcancelcapture"?: MainThreadEventHandler<
		LynxListAnimationCancelEvent<MainThread.Element>
	>;
	/** `listanimationcancel`, in a main-thread function, caught here. */
	"main-thread:oncatchlistanimationcancel"?: MainThreadEventHandler<
		LynxListAnimationCancelEvent<MainThread.Element>
	>;
	/** `listanimationcancel`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlistanimationcancelcapture"?: MainThreadEventHandler<
		LynxListAnimationCancelEvent<MainThread.Element>
	>;
	/** Called with progress updates grouped by transaction and animation type. */
	onlistanimationupdate?: LynxEventHandler<
		LynxListAnimationUpdateEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationupdate`, heard in the capture phase: before the elements inside. */
	onlistanimationupdatecapture?: LynxEventHandler<
		LynxListAnimationUpdateEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationupdate`, caught here: the elements this is inside do not hear it. */
	oncatchlistanimationupdate?: LynxEventHandler<
		LynxListAnimationUpdateEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationupdate`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlistanimationupdatecapture?: LynxEventHandler<
		LynxListAnimationUpdateEvent<LynxNode, LynxNode<"list">>
	>;
	/** `listanimationupdate`, in a main-thread function. */
	"main-thread:onlistanimationupdate"?: MainThreadEventHandler<
		LynxListAnimationUpdateEvent<MainThread.Element>
	>;
	/** `listanimationupdate`, in a main-thread function, in the capture phase. */
	"main-thread:onlistanimationupdatecapture"?: MainThreadEventHandler<
		LynxListAnimationUpdateEvent<MainThread.Element>
	>;
	/** `listanimationupdate`, in a main-thread function, caught here. */
	"main-thread:oncatchlistanimationupdate"?: MainThreadEventHandler<
		LynxListAnimationUpdateEvent<MainThread.Element>
	>;
	/** `listanimationupdate`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlistanimationupdatecapture"?: MainThreadEventHandler<
		LynxListAnimationUpdateEvent<MainThread.Element>
	>;
	/** Scroll event. */
	onscroll?: LynxEventHandler<LynxListScrollEvent<LynxNode, LynxNode<"list">>>;
	/** `scroll`, heard in the capture phase: before the elements inside. */
	onscrollcapture?: LynxEventHandler<LynxListScrollEvent<LynxNode, LynxNode<"list">>>;
	/** `scroll`, caught here: the elements this is inside do not hear it. */
	oncatchscroll?: LynxEventHandler<LynxListScrollEvent<LynxNode, LynxNode<"list">>>;
	/** `scroll`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrollcapture?: LynxEventHandler<LynxListScrollEvent<LynxNode, LynxNode<"list">>>;
	/** `scroll`, in a main-thread function. */
	"main-thread:onscroll"?: MainThreadEventHandler<LynxListScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, in the capture phase. */
	"main-thread:onscrollcapture"?: MainThreadEventHandler<LynxListScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, caught here. */
	"main-thread:oncatchscroll"?: MainThreadEventHandler<LynxListScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrollcapture"?: MainThreadEventHandler<
		LynxListScrollEvent<MainThread.Element>
	>;
	/** Callback function for scrolling to the top. */
	onscrolltoupper?: LynxEventHandler<LynxListScrollToUpperEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltoupper`, heard in the capture phase: before the elements inside. */
	onscrolltouppercapture?: LynxEventHandler<LynxListScrollToUpperEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltoupper`, caught here: the elements this is inside do not hear it. */
	oncatchscrolltoupper?: LynxEventHandler<LynxListScrollToUpperEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltoupper`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrolltouppercapture?: LynxEventHandler<
		LynxListScrollToUpperEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrolltoupper`, in a main-thread function. */
	"main-thread:onscrolltoupper"?: MainThreadEventHandler<
		LynxListScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, in the capture phase. */
	"main-thread:onscrolltouppercapture"?: MainThreadEventHandler<
		LynxListScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, caught here. */
	"main-thread:oncatchscrolltoupper"?: MainThreadEventHandler<
		LynxListScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrolltouppercapture"?: MainThreadEventHandler<
		LynxListScrollToUpperEvent<MainThread.Element>
	>;
	/** Callback function for scrolling to the bottom. */
	onscrolltolower?: LynxEventHandler<LynxListScrollToLowerEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltolower`, heard in the capture phase: before the elements inside. */
	onscrolltolowercapture?: LynxEventHandler<LynxListScrollToLowerEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltolower`, caught here: the elements this is inside do not hear it. */
	oncatchscrolltolower?: LynxEventHandler<LynxListScrollToLowerEvent<LynxNode, LynxNode<"list">>>;
	/** `scrolltolower`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrolltolowercapture?: LynxEventHandler<
		LynxListScrollToLowerEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrolltolower`, in a main-thread function. */
	"main-thread:onscrolltolower"?: MainThreadEventHandler<
		LynxListScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, in the capture phase. */
	"main-thread:onscrolltolowercapture"?: MainThreadEventHandler<
		LynxListScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, caught here. */
	"main-thread:oncatchscrolltolower"?: MainThreadEventHandler<
		LynxListScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrolltolowercapture"?: MainThreadEventHandler<
		LynxListScrollToLowerEvent<MainThread.Element>
	>;
	/** This callback function is triggered when the scrolling state of the list changes. */
	onscrollstatechange?: LynxEventHandler<
		LynxListScrollStateChangeEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrollstatechange`, heard in the capture phase: before the elements inside. */
	onscrollstatechangecapture?: LynxEventHandler<
		LynxListScrollStateChangeEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrollstatechange`, caught here: the elements this is inside do not hear it. */
	oncatchscrollstatechange?: LynxEventHandler<
		LynxListScrollStateChangeEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrollstatechange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrollstatechangecapture?: LynxEventHandler<
		LynxListScrollStateChangeEvent<LynxNode, LynxNode<"list">>
	>;
	/** `scrollstatechange`, in a main-thread function. */
	"main-thread:onscrollstatechange"?: MainThreadEventHandler<
		LynxListScrollStateChangeEvent<MainThread.Element>
	>;
	/** `scrollstatechange`, in a main-thread function, in the capture phase. */
	"main-thread:onscrollstatechangecapture"?: MainThreadEventHandler<
		LynxListScrollStateChangeEvent<MainThread.Element>
	>;
	/** `scrollstatechange`, in a main-thread function, caught here. */
	"main-thread:oncatchscrollstatechange"?: MainThreadEventHandler<
		LynxListScrollStateChangeEvent<MainThread.Element>
	>;
	/** `scrollstatechange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrollstatechangecapture"?: MainThreadEventHandler<
		LynxListScrollStateChangeEvent<MainThread.Element>
	>;
	/** This callback function will be triggered when the first screen of the list has finished rendering. On iOS, this callback function will be triggered when list has an update. */
	onlayoutcomplete?: LynxEventHandler<LynxListLayoutCompleteEvent<LynxNode, LynxNode<"list">>>;
	/** `layoutcomplete`, heard in the capture phase: before the elements inside. */
	onlayoutcompletecapture?: LynxEventHandler<
		LynxListLayoutCompleteEvent<LynxNode, LynxNode<"list">>
	>;
	/** `layoutcomplete`, caught here: the elements this is inside do not hear it. */
	oncatchlayoutcomplete?: LynxEventHandler<LynxListLayoutCompleteEvent<LynxNode, LynxNode<"list">>>;
	/** `layoutcomplete`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlayoutcompletecapture?: LynxEventHandler<
		LynxListLayoutCompleteEvent<LynxNode, LynxNode<"list">>
	>;
	/** `layoutcomplete`, in a main-thread function. */
	"main-thread:onlayoutcomplete"?: MainThreadEventHandler<
		LynxListLayoutCompleteEvent<MainThread.Element>
	>;
	/** `layoutcomplete`, in a main-thread function, in the capture phase. */
	"main-thread:onlayoutcompletecapture"?: MainThreadEventHandler<
		LynxListLayoutCompleteEvent<MainThread.Element>
	>;
	/** `layoutcomplete`, in a main-thread function, caught here. */
	"main-thread:oncatchlayoutcomplete"?: MainThreadEventHandler<
		LynxListLayoutCompleteEvent<MainThread.Element>
	>;
	/** `layoutcomplete`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlayoutcompletecapture"?: MainThreadEventHandler<
		LynxListLayoutCompleteEvent<MainThread.Element>
	>;
	/** Snap callback */
	onsnap?: LynxEventHandler<LynxListSnapEvent<LynxNode, LynxNode<"list">>>;
	/** `snap`, heard in the capture phase: before the elements inside. */
	onsnapcapture?: LynxEventHandler<LynxListSnapEvent<LynxNode, LynxNode<"list">>>;
	/** `snap`, caught here: the elements this is inside do not hear it. */
	oncatchsnap?: LynxEventHandler<LynxListSnapEvent<LynxNode, LynxNode<"list">>>;
	/** `snap`, caught in the capture phase: the elements inside do not hear it. */
	oncatchsnapcapture?: LynxEventHandler<LynxListSnapEvent<LynxNode, LynxNode<"list">>>;
	/** `snap`, in a main-thread function. */
	"main-thread:onsnap"?: MainThreadEventHandler<LynxListSnapEvent<MainThread.Element>>;
	/** `snap`, in a main-thread function, in the capture phase. */
	"main-thread:onsnapcapture"?: MainThreadEventHandler<LynxListSnapEvent<MainThread.Element>>;
	/** `snap`, in a main-thread function, caught here. */
	"main-thread:oncatchsnap"?: MainThreadEventHandler<LynxListSnapEvent<MainThread.Element>>;
	/** `snap`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchsnapcapture"?: MainThreadEventHandler<LynxListSnapEvent<MainThread.Element>>;
}

/** The events `<list>` sends, by name, as its listeners hear them. */
export interface LynxListEvents extends LynxCommonEvents<"list">, LynxDefaultEvents<"list"> {
	/** Called when an animation type starts within a transaction. */
	listanimationstart: LynxListAnimationStartEvent<LynxNode, LynxNode<"list">>;
	/** Called when all participating items of an animation type finish normally. */
	listanimationend: LynxListAnimationEndEvent<LynxNode, LynxNode<"list">>;
	/** Called when a started, unfinished animation type is canceled. */
	listanimationcancel: LynxListAnimationCancelEvent<LynxNode, LynxNode<"list">>;
	/** Called with progress updates grouped by transaction and animation type. */
	listanimationupdate: LynxListAnimationUpdateEvent<LynxNode, LynxNode<"list">>;
	/** Scroll event. */
	scroll: LynxListScrollEvent<LynxNode, LynxNode<"list">>;
	/** Callback function for scrolling to the top. */
	scrolltoupper: LynxListScrollToUpperEvent<LynxNode, LynxNode<"list">>;
	/** Callback function for scrolling to the bottom. */
	scrolltolower: LynxListScrollToLowerEvent<LynxNode, LynxNode<"list">>;
	/** This callback function is triggered when the scrolling state of the list changes. */
	scrollstatechange: LynxListScrollStateChangeEvent<LynxNode, LynxNode<"list">>;
	/** This callback function will be triggered when the first screen of the list has finished rendering. On iOS, this callback function will be triggered when list has an update. */
	layoutcomplete: LynxListLayoutCompleteEvent<LynxNode, LynxNode<"list">>;
	/** Snap callback */
	snap: LynxListSnapEvent<LynxNode, LynxNode<"list">>;
}

/** The attributes and events of `<list-item>`. */
export interface LynxListItemAttributes
	extends LynxCommonAttributes<"list-item">, LynxDefaultAttributes<"list-item"> {
	/** The unique key of list child node, and it's a mandatory property. */
	"item-key"?: string | null;
	/**
	 * sticky top effect. Not compatible with flatten.
	 * @defaultValue false
	 */
	"sticky-top"?: boolean | null;
	/**
	 * sticky bottom effect. Not compatible with flatten.
	 * @defaultValue false
	 */
	"sticky-bottom"?: boolean | null;
	/**
	 * Adding the `full-span` attribute to `<list-item/>` will make it occupy a single line. You need to configure {@link ListProps. "list-type" | list-type} correctly to make the list enter a multi-column layout for this to work.
	 * @defaultValue false
	 */
	"full-span"?: boolean | null;
	/**
	 * Preset size in main scroll axis to control the placeholder size of the view while the list component has not finished rendering. The more accurately it is set, the less flickering the list will have. If not set, we will use list size in main axis as the estimated size of list-item.
	 * @defaultValue -1
	 */
	"estimated-main-axis-size-px"?: number | null;
	/**
	 * Control whether the list-item can be recycled. If set to false, the list-item will not be recycled after being scrolled off the screen, and do not need to be re-rendered when they come back on the screen. The default value is true.
	 * @defaultValue true
	 */
	recyclable?: boolean | null;
	/**
	 * The kind of row this is: the list reuses a row's native view only for a row of the same kind.
	 *
	 * @workaround list-item-reuse-identifier kind=lynx-gap delete-when="@lynx-js/types declares reuse-identifier on <list-item>: remove it from scripts/types/additions.ts"
	 */
	"reuse-identifier"?: string | null;
	/** Renders the row's contents only once Lynx asks for the row, unless it is among its list's initial rows. With `unmountRecycled`, the contents unmount when the page lets go of the row, and render afresh when it shows again. */
	defer?: boolean | { unmountRecycled?: boolean } | null;
}

/** The events `<list-item>` sends, by name, as its listeners hear them. */
export interface LynxListItemEvents
	extends LynxCommonEvents<"list-item">, LynxDefaultEvents<"list-item"> {}

/** The attributes and events of `<list-row>`. */
export interface LynxListRowAttributes
	extends LynxCommonAttributes<"list-row">, LynxDefaultAttributes<"list-row"> {}

/** The events `<list-row>` sends, by name, as its listeners hear them. */
export interface LynxListRowEvents
	extends LynxCommonEvents<"list-row">, LynxDefaultEvents<"list-row"> {}

/** The attributes and events of `<page>`. */
export interface LynxPageAttributes
	extends LynxCommonAttributes<"page">, LynxDefaultAttributes<"page"> {}

/** The events `<page>` sends, by name, as its listeners hear them. */
export interface LynxPageEvents extends LynxCommonEvents<"page">, LynxDefaultEvents<"page"> {}

/** The attributes and events of `<scroll-view>`. */
export interface LynxScrollViewAttributes
	extends LynxCommonAttributes<"scroll-view">, LynxDefaultAttributes<"scroll-view"> {
	/**
	 * Replacement of scroll-x and scroll-y
	 * @defaultValue 'vertical'
	 */
	"scroll-orientation"?: "horizontal" | "vertical" | null;
	/**
	 * Enable bounce effect
	 * @defaultValue true
	 */
	bounces?: boolean | null;
	/**
	 * Enable dragging
	 * @defaultValue true
	 */
	"enable-scroll"?: boolean | null;
	/**
	 * Enables the experimental Android overflow clipping implementation for scroll-view.
	 * @defaultValue true
	 */
	"experimental-android-enable-new-overflow"?: boolean | null;
	/**
	 * Enable scrollbar
	 * @defaultValue true
	 */
	"scroll-bar-enable"?: boolean | null;
	/**
	 * Set upper threshold to onscrolltoupper event.
	 * @defaultValue 0
	 */
	"upper-threshold"?: number | null;
	/**
	 * Set upper threshold to onscrolltoupper event.
	 * @defaultValue 0
	 */
	"lower-threshold"?: number | null;
	/**
	 * Initial scroll position, only effective once, in PX
	 * @defaultValue 0
	 */
	"initial-scroll-offset"?: number | null;
	/**
	 * Scroll to specified child node on first screen, only effective once. All direct child nodes must be flatten=false.
	 * @defaultValue 0
	 */
	"initial-scroll-to-index"?: number | null;
	/**
	 * Whether to display the scrollbar.
	 * @defaultValue false
	 */
	"enable-scrollbar"?: boolean | null;
	/**
	 * Whether to hide the scrollbar automatically when it is inactive.
	 * @defaultValue true
	 */
	"scroll-bar-auto-hide"?: boolean | null;
	/**
	 * Width of the scrollbar track, in px.
	 * @defaultValue 12
	 */
	"scroll-bar-width"?: number | null;
	/**
	 * Width of the scrollbar thumb, in px.
	 * @defaultValue 8
	 */
	"scroll-bar-thumb-width"?: number | null;
	/**
	 * Minimum length of the scrollbar thumb, in px.
	 * @defaultValue 18
	 */
	"scroll-bar-thumb-min-length"?: number | null;
	/**
	 * Corner radius of the scrollbar thumb, in px.
	 * @defaultValue 4
	 */
	"scroll-bar-thumb-radius"?: number | null;
	/**
	 * Color of the scrollbar thumb.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.4)'
	 */
	"scroll-bar-thumb-color"?: string | null;
	/**
	 * Color of the scrollbar thumb while it is being dragged.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.8)'
	 */
	"scroll-bar-thumb-active-color"?: string | null;
	/**
	 * Color of the scrollbar thumb while the pointer is hovering over it.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'rgba(0, 0, 0, 0.8)'
	 */
	"scroll-bar-thumb-hover-color"?: string | null;
	/**
	 * Color of the scrollbar track.
	 * Supported formats are named colors, #RGB, #RRGGBB, #RRGGBBAA, and comma-separated rgb(), rgba(), hsl(), and hsla().
	 * @defaultValue 'transparent'
	 */
	"scroll-bar-track-color"?: string | null;
	/**
	 * Delay before automatically hiding the scrollbar, in ms.
	 * @defaultValue 1000
	 */
	"scroll-bar-auto-hide-delay"?: number | null;
	/**
	 * This event is triggered when the upper/left edge of the scrolling area intersects with the visible area defined by the upperThreshold.
	 * @defaultValue none
	 */
	onscrolltoupper?: LynxEventHandler<LynxScrollToUpperEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrolltoupper`, heard in the capture phase: before the elements inside. */
	onscrolltouppercapture?: LynxEventHandler<
		LynxScrollToUpperEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltoupper`, caught here: the elements this is inside do not hear it. */
	oncatchscrolltoupper?: LynxEventHandler<
		LynxScrollToUpperEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltoupper`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrolltouppercapture?: LynxEventHandler<
		LynxScrollToUpperEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltoupper`, in a main-thread function. */
	"main-thread:onscrolltoupper"?: MainThreadEventHandler<
		LynxScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, in the capture phase. */
	"main-thread:onscrolltouppercapture"?: MainThreadEventHandler<
		LynxScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, caught here. */
	"main-thread:oncatchscrolltoupper"?: MainThreadEventHandler<
		LynxScrollToUpperEvent<MainThread.Element>
	>;
	/** `scrolltoupper`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrolltouppercapture"?: MainThreadEventHandler<
		LynxScrollToUpperEvent<MainThread.Element>
	>;
	/**
	 * This event is triggered when the lower/right edge of the scrolling area intersects with the visible area defined by the lowerThreshold.
	 * @defaultValue none
	 */
	onscrolltolower?: LynxEventHandler<LynxScrollToLowerEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrolltolower`, heard in the capture phase: before the elements inside. */
	onscrolltolowercapture?: LynxEventHandler<
		LynxScrollToLowerEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltolower`, caught here: the elements this is inside do not hear it. */
	oncatchscrolltolower?: LynxEventHandler<
		LynxScrollToLowerEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltolower`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrolltolowercapture?: LynxEventHandler<
		LynxScrollToLowerEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `scrolltolower`, in a main-thread function. */
	"main-thread:onscrolltolower"?: MainThreadEventHandler<
		LynxScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, in the capture phase. */
	"main-thread:onscrolltolowercapture"?: MainThreadEventHandler<
		LynxScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, caught here. */
	"main-thread:oncatchscrolltolower"?: MainThreadEventHandler<
		LynxScrollToLowerEvent<MainThread.Element>
	>;
	/** `scrolltolower`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrolltolowercapture"?: MainThreadEventHandler<
		LynxScrollToLowerEvent<MainThread.Element>
	>;
	/**
	 * This event is triggered when the scrollview is scrolling.
	 * @defaultValue none
	 */
	onscroll?: LynxEventHandler<LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scroll`, heard in the capture phase: before the elements inside. */
	onscrollcapture?: LynxEventHandler<LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scroll`, caught here: the elements this is inside do not hear it. */
	oncatchscroll?: LynxEventHandler<LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scroll`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrollcapture?: LynxEventHandler<LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scroll`, in a main-thread function. */
	"main-thread:onscroll"?: MainThreadEventHandler<LynxScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, in the capture phase. */
	"main-thread:onscrollcapture"?: MainThreadEventHandler<LynxScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, caught here. */
	"main-thread:oncatchscroll"?: MainThreadEventHandler<LynxScrollEvent<MainThread.Element>>;
	/** `scroll`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrollcapture"?: MainThreadEventHandler<LynxScrollEvent<MainThread.Element>>;
	/**
	 * This event is triggered when the scrollview's scroll ended.
	 * @defaultValue none
	 */
	onscrollend?: LynxEventHandler<LynxScrollEndEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrollend`, heard in the capture phase: before the elements inside. */
	onscrollendcapture?: LynxEventHandler<LynxScrollEndEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrollend`, caught here: the elements this is inside do not hear it. */
	oncatchscrollend?: LynxEventHandler<LynxScrollEndEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrollend`, caught in the capture phase: the elements inside do not hear it. */
	oncatchscrollendcapture?: LynxEventHandler<LynxScrollEndEvent<LynxNode, LynxNode<"scroll-view">>>;
	/** `scrollend`, in a main-thread function. */
	"main-thread:onscrollend"?: MainThreadEventHandler<LynxScrollEndEvent<MainThread.Element>>;
	/** `scrollend`, in a main-thread function, in the capture phase. */
	"main-thread:onscrollendcapture"?: MainThreadEventHandler<LynxScrollEndEvent<MainThread.Element>>;
	/** `scrollend`, in a main-thread function, caught here. */
	"main-thread:oncatchscrollend"?: MainThreadEventHandler<LynxScrollEndEvent<MainThread.Element>>;
	/** `scrollend`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchscrollendcapture"?: MainThreadEventHandler<
		LynxScrollEndEvent<MainThread.Element>
	>;
	/**
	 * This event is triggered when the scrollview's content size changed.
	 * @defaultValue none
	 */
	oncontentsizechanged?: LynxEventHandler<
		LynxContentSizeChangedEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `contentsizechanged`, heard in the capture phase: before the elements inside. */
	oncontentsizechangedcapture?: LynxEventHandler<
		LynxContentSizeChangedEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `contentsizechanged`, caught here: the elements this is inside do not hear it. */
	oncatchcontentsizechanged?: LynxEventHandler<
		LynxContentSizeChangedEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `contentsizechanged`, caught in the capture phase: the elements inside do not hear it. */
	oncatchcontentsizechangedcapture?: LynxEventHandler<
		LynxContentSizeChangedEvent<LynxNode, LynxNode<"scroll-view">>
	>;
	/** `contentsizechanged`, in a main-thread function. */
	"main-thread:oncontentsizechanged"?: MainThreadEventHandler<
		LynxContentSizeChangedEvent<MainThread.Element>
	>;
	/** `contentsizechanged`, in a main-thread function, in the capture phase. */
	"main-thread:oncontentsizechangedcapture"?: MainThreadEventHandler<
		LynxContentSizeChangedEvent<MainThread.Element>
	>;
	/** `contentsizechanged`, in a main-thread function, caught here. */
	"main-thread:oncatchcontentsizechanged"?: MainThreadEventHandler<
		LynxContentSizeChangedEvent<MainThread.Element>
	>;
	/** `contentsizechanged`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchcontentsizechangedcapture"?: MainThreadEventHandler<
		LynxContentSizeChangedEvent<MainThread.Element>
	>;
}

/** The events `<scroll-view>` sends, by name, as its listeners hear them. */
export interface LynxScrollViewEvents
	extends LynxCommonEvents<"scroll-view">, LynxDefaultEvents<"scroll-view"> {
	/**
	 * This event is triggered when the upper/left edge of the scrolling area intersects with the visible area defined by the upperThreshold.
	 * @defaultValue none
	 */
	scrolltoupper: LynxScrollToUpperEvent<LynxNode, LynxNode<"scroll-view">>;
	/**
	 * This event is triggered when the lower/right edge of the scrolling area intersects with the visible area defined by the lowerThreshold.
	 * @defaultValue none
	 */
	scrolltolower: LynxScrollToLowerEvent<LynxNode, LynxNode<"scroll-view">>;
	/**
	 * This event is triggered when the scrollview is scrolling.
	 * @defaultValue none
	 */
	scroll: LynxScrollEvent<LynxNode, LynxNode<"scroll-view">>;
	/**
	 * This event is triggered when the scrollview's scroll ended.
	 * @defaultValue none
	 */
	scrollend: LynxScrollEndEvent<LynxNode, LynxNode<"scroll-view">>;
	/**
	 * This event is triggered when the scrollview's content size changed.
	 * @defaultValue none
	 */
	contentsizechanged: LynxContentSizeChangedEvent<LynxNode, LynxNode<"scroll-view">>;
}

/** The attributes and events of `<text>`. */
export interface LynxTextAttributes
	extends LynxCommonAttributes<"text">, LynxDefaultAttributes<"text"> {
	/**
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Background color of selected text, encoded as a 32-bit ARGB number.
	 */
	"selection-background-color"?: number | null;
	/**
	 * Clay Android and Clay Harmony support begins in prerelease builds; the corresponding stable releases omit this API.
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Color of the text selection handles. Use a numeric ARGB color on native mobile platforms; Clay additionally accepts color strings.
	 */
	"selection-handle-color"?: string | number | null;
	/**
	 * Clay Android and Clay Harmony support begins in prerelease builds; the corresponding stable releases omit this API.
	 * Backported to 2.18 on Android and iOS; availability differs across later maintenance releases.
	 * Size of the text selection handle. Android uses physical pixels; iOS and Harmony use logical units.
	 * Omitted values and zero follow each platform's native defaults.
	 */
	"selection-handle-size"?: number | null;
	/** Maximum number of lines for text display */
	"text-maxline"?: string | null;
	/**
	 * Maximum number of characters for text display
	 * @deprecated Suggest preprocessing the text content length.
	 */
	"text-maxlength"?: string | null;
	/**
	 * Whether font-size is affected by system font scaling
	 * @defaultValue false
	 * @deprecated
	 */
	"enable-font-scaling"?: boolean | null;
	/**
	 * Baseline adjustment strategy in vertical direction; note: setting this value does not guarantee text centering
	 * @defaultValue ""
	 * @deprecated Use the text-single-line-vertical-align attribute instead.
	 */
	"text-vertical-align"?: "center" | "top" | "bottom" | null;
	/**
	 * By default, if text truncation occurs, the color of the inserted ... will be specified by the style on the nearest inline-text. If this attribute is enabled, the color of ... will be specified by the style on the outermost text tag.
	 * @defaultValue false
	 */
	"tail-color-convert"?: boolean | null;
	/**
	 * Set single-line plain text to be centered and aligned within the line. Inline text settings are not supported. Recommended only when the default font doesn't meet center alignment needs, as it increases text measurement time.
	 * @defaultValue 'normal'
	 */
	"text-single-line-vertical-align"?: "normal" | "center" | "top" | "bottom" | null;
	/**
	 * Enable additional spacing above and below the text on Android; recommended only in high language scenarios to avoid text truncation.
	 * @defaultValue false
	 */
	"include-font-padding"?: boolean | null;
	/**
	 * Enable support for Emoji2 adaptation; requires androidx.emoji2 dependency.
	 * @defaultValue false
	 */
	"android-emoji-compat"?: boolean | null;
	/**
	 * Enables fake bold for fonts when the default bold is not found.
	 * @defaultValue false
	 */
	"text-fake-bold"?: boolean | null;
	/**
	 * Sets whether to enable text selection.
	 * @defaultValue false
	 */
	"text-selection"?: boolean | null;
	/**
	 * Used to set whether to turn on the custom pop-up context menu after selection and copying. It takes effect after enabling text-selection.
	 * @defaultValue false
	 */
	"custom-context-menu"?: boolean | null;
	/**
	 * Used to set whether to enable the custom text selection function. When it is enabled, the element will no longer handle the gesture logic related to selection and copying. It takes effect after enabling text-selection.
	 * @defaultValue false
	 */
	"custom-text-selection"?: boolean | null;
	/**
	 * Shift text or an inline image vertically relative to the text baseline. Positive values move it down.
	 * A px string is converted to device pixels, a percentage is relative to font size,
	 * and a unitless string is a font-size multiplier.
	 * For text, an explicit zero string still selects custom baseline alignment.
	 * @defaultValue Unset; the stored shift is 0 and no custom text baseline alignment is applied.
	 */
	"custom-baseline-shift"?: string | null;
	/** Text layout event */
	onlayout?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"text">>>;
	/** `layout`, heard in the capture phase: before the elements inside. */
	onlayoutcapture?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"text">>>;
	/** `layout`, caught here: the elements this is inside do not hear it. */
	oncatchlayout?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"text">>>;
	/** `layout`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlayoutcapture?: LynxEventHandler<LynxLayoutEvent<LynxNode, LynxNode<"text">>>;
	/** `layout`, in a main-thread function. */
	"main-thread:onlayout"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, in the capture phase. */
	"main-thread:onlayoutcapture"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, caught here. */
	"main-thread:oncatchlayout"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** `layout`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlayoutcapture"?: MainThreadEventHandler<LynxLayoutEvent<MainThread.Element>>;
	/** Text selection change event */
	onselectionchange?: LynxEventHandler<LynxSelectionChangeEvent<LynxNode, LynxNode<"text">>>;
	/** `selectionchange`, heard in the capture phase: before the elements inside. */
	onselectionchangecapture?: LynxEventHandler<LynxSelectionChangeEvent<LynxNode, LynxNode<"text">>>;
	/** `selectionchange`, caught here: the elements this is inside do not hear it. */
	oncatchselectionchange?: LynxEventHandler<LynxSelectionChangeEvent<LynxNode, LynxNode<"text">>>;
	/** `selectionchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchselectionchangecapture?: LynxEventHandler<
		LynxSelectionChangeEvent<LynxNode, LynxNode<"text">>
	>;
	/** `selectionchange`, in a main-thread function. */
	"main-thread:onselectionchange"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, in the capture phase. */
	"main-thread:onselectionchangecapture"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught here. */
	"main-thread:oncatchselectionchange"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchselectionchangecapture"?: MainThreadEventHandler<
		LynxSelectionChangeEvent<MainThread.Element>
	>;
}

/** The events `<text>` sends, by name, as its listeners hear them. */
export interface LynxTextEvents extends LynxCommonEvents<"text">, LynxDefaultEvents<"text"> {
	/** Text layout event */
	layout: LynxLayoutEvent<LynxNode, LynxNode<"text">>;
	/** Text selection change event */
	selectionchange: LynxSelectionChangeEvent<LynxNode, LynxNode<"text">>;
}

/** The attributes and events of `<view>`. */
export interface LynxViewAttributes
	extends LynxCommonAttributes<"view">, LynxDefaultAttributes<"view"> {}

/** The events `<view>` sends, by name, as its listeners hear them. */
export interface LynxViewEvents extends LynxCommonEvents<"view">, LynxDefaultEvents<"view"> {}

/** The attributes and events of `<raw-text>`. */
export interface LynxRawTextAttributes
	extends LynxCommonAttributes<"raw-text">, LynxDefaultAttributes<"raw-text"> {
	text: string | number;
}

/** The events `<raw-text>` sends, by name, as its listeners hear them. */
export interface LynxRawTextEvents
	extends LynxCommonEvents<"raw-text">, LynxDefaultEvents<"raw-text"> {}

/** The attributes and events of `<input>`. */
export interface LynxInputAttributes extends LynxCommonAttributes<"input"> {
	/**
	 * Keep the editor focused after confirmation instead of dismissing the keyboard.
	 * The next action still performs native focus traversal.
	 * @defaultValue false
	 */
	"confirm-enter"?: boolean | null;
	/** Placeholder */
	placeholder?: string | null;
	/** Initial input content. Only applies on the first render and does not trigger `oninput`. */
	"default-value"?: string | null;
	/**
	 * The type of confirm button
	 * @defaultValue 'send'
	 */
	"confirm-type"?: "search" | "send" | "go" | "done" | "next" | null;
	/**
	 * Max input length
	 * @defaultValue 140
	 */
	maxlength?: number | null;
	/**
	 * Readonly
	 * @defaultValue false
	 */
	readonly?: boolean | null;
	/**
	 * Interaction enabled
	 * @defaultValue false
	 */
	disabled?: boolean | null;
	/**
	 * Show soft input keyboard while focused
	 * @defaultValue true
	 */
	"show-soft-input-on-focus"?: boolean | null;
	/**
	 * Sets how the host avoids the soft keyboard.
	 *
	 * - `unspecified`: Uses the platform default behavior.
	 * - `nothing`: Leaves the host window or page unchanged when the keyboard appears.
	 * - `pan`: Moves the host content to keep the focused input visible.
	 * - `resize`: Resizes the host content to fit above the keyboard.
	 *
	 * This setting affects the owning Android window or Harmony UI context, including
	 * sibling views that share it. It is not restored automatically when this input
	 * loses focus or is removed. Omitting the property leaves the current host setting
	 * unchanged. Unsupported strings fall back to `unspecified`.
	 *
	 * This property is independent of `avoid-keyboard`, which controls Lynx's own
	 * keyboard avoidance. On Android, `android-set-soft-input-mode` remains available
	 * as a compatibility alias. Harmony support requires API 14 or later.
	 */
	"set-soft-input-mode"?: "unspecified" | "nothing" | "pan" | "resize" | null;
	/**
	 * Filter the input content and process it in the form of regular expressions
	 * @defaultValue undefined
	 */
	"input-filter"?: string | null;
	/**
	 * Input content type
	 * @defaultValue "text"
	 */
	type?: "number" | "text" | "digit" | "password" | "tel" | "email" | null;
	/**
	 * Auto correct input content on iOS
	 * @defaultValue true
	 */
	"ios-auto-correct"?: boolean | null;
	/**
	 * Check spelling issue on iOS
	 * @defaultValue true
	 */
	"ios-spell-check"?: boolean | null;
	/**
	 * Whether to enter the full-screen input mode when in landscape screen, in which the keyboard and input box will take up the entire screen
	 * @defaultValue true
	 */
	"android-fullscreen-mode"?: boolean | null;
	/** The text in the field, as on the web: write it back in `oninput` (`oninput={(event) => (text = event.detail.value)}`). */
	value?: string | null;
	/** Focused */
	onfocus?: LynxEventHandler<LynxInputFocusEvent<LynxNode, LynxNode<"input">>>;
	/** `focus`, heard in the capture phase: before the elements inside. */
	onfocuscapture?: LynxEventHandler<LynxInputFocusEvent<LynxNode, LynxNode<"input">>>;
	/** `focus`, caught here: the elements this is inside do not hear it. */
	oncatchfocus?: LynxEventHandler<LynxInputFocusEvent<LynxNode, LynxNode<"input">>>;
	/** `focus`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfocuscapture?: LynxEventHandler<LynxInputFocusEvent<LynxNode, LynxNode<"input">>>;
	/** `focus`, in a main-thread function. */
	"main-thread:onfocus"?: MainThreadEventHandler<LynxInputFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, in the capture phase. */
	"main-thread:onfocuscapture"?: MainThreadEventHandler<LynxInputFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught here. */
	"main-thread:oncatchfocus"?: MainThreadEventHandler<LynxInputFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfocuscapture"?: MainThreadEventHandler<
		LynxInputFocusEvent<MainThread.Element>
	>;
	/** Blurred */
	onblur?: LynxEventHandler<LynxInputBlurEvent<LynxNode, LynxNode<"input">>>;
	/** `blur`, heard in the capture phase: before the elements inside. */
	onblurcapture?: LynxEventHandler<LynxInputBlurEvent<LynxNode, LynxNode<"input">>>;
	/** `blur`, caught here: the elements this is inside do not hear it. */
	oncatchblur?: LynxEventHandler<LynxInputBlurEvent<LynxNode, LynxNode<"input">>>;
	/** `blur`, caught in the capture phase: the elements inside do not hear it. */
	oncatchblurcapture?: LynxEventHandler<LynxInputBlurEvent<LynxNode, LynxNode<"input">>>;
	/** `blur`, in a main-thread function. */
	"main-thread:onblur"?: MainThreadEventHandler<LynxInputBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, in the capture phase. */
	"main-thread:onblurcapture"?: MainThreadEventHandler<LynxInputBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught here. */
	"main-thread:oncatchblur"?: MainThreadEventHandler<LynxInputBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchblurcapture"?: MainThreadEventHandler<LynxInputBlurEvent<MainThread.Element>>;
	/** Confirm button clicked */
	onconfirm?: LynxEventHandler<LynxInputConfirmEvent<LynxNode, LynxNode<"input">>>;
	/** `confirm`, heard in the capture phase: before the elements inside. */
	onconfirmcapture?: LynxEventHandler<LynxInputConfirmEvent<LynxNode, LynxNode<"input">>>;
	/** `confirm`, caught here: the elements this is inside do not hear it. */
	oncatchconfirm?: LynxEventHandler<LynxInputConfirmEvent<LynxNode, LynxNode<"input">>>;
	/** `confirm`, caught in the capture phase: the elements inside do not hear it. */
	oncatchconfirmcapture?: LynxEventHandler<LynxInputConfirmEvent<LynxNode, LynxNode<"input">>>;
	/** `confirm`, in a main-thread function. */
	"main-thread:onconfirm"?: MainThreadEventHandler<LynxInputConfirmEvent<MainThread.Element>>;
	/** `confirm`, in a main-thread function, in the capture phase. */
	"main-thread:onconfirmcapture"?: MainThreadEventHandler<
		LynxInputConfirmEvent<MainThread.Element>
	>;
	/** `confirm`, in a main-thread function, caught here. */
	"main-thread:oncatchconfirm"?: MainThreadEventHandler<LynxInputConfirmEvent<MainThread.Element>>;
	/** `confirm`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchconfirmcapture"?: MainThreadEventHandler<
		LynxInputConfirmEvent<MainThread.Element>
	>;
	/** Input content changed */
	oninput?: LynxEventHandler<LynxInputEvent<LynxNode, LynxNode<"input">>>;
	/** `input`, heard in the capture phase: before the elements inside. */
	oninputcapture?: LynxEventHandler<LynxInputEvent<LynxNode, LynxNode<"input">>>;
	/** `input`, caught here: the elements this is inside do not hear it. */
	oncatchinput?: LynxEventHandler<LynxInputEvent<LynxNode, LynxNode<"input">>>;
	/** `input`, caught in the capture phase: the elements inside do not hear it. */
	oncatchinputcapture?: LynxEventHandler<LynxInputEvent<LynxNode, LynxNode<"input">>>;
	/** `input`, in a main-thread function. */
	"main-thread:oninput"?: MainThreadEventHandler<LynxInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, in the capture phase. */
	"main-thread:oninputcapture"?: MainThreadEventHandler<LynxInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, caught here. */
	"main-thread:oncatchinput"?: MainThreadEventHandler<LynxInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchinputcapture"?: MainThreadEventHandler<LynxInputEvent<MainThread.Element>>;
	/** Input selection changed */
	onselection?: LynxEventHandler<LynxInputSelectionEvent<LynxNode, LynxNode<"input">>>;
	/** `selection`, heard in the capture phase: before the elements inside. */
	onselectioncapture?: LynxEventHandler<LynxInputSelectionEvent<LynxNode, LynxNode<"input">>>;
	/** `selection`, caught here: the elements this is inside do not hear it. */
	oncatchselection?: LynxEventHandler<LynxInputSelectionEvent<LynxNode, LynxNode<"input">>>;
	/** `selection`, caught in the capture phase: the elements inside do not hear it. */
	oncatchselectioncapture?: LynxEventHandler<LynxInputSelectionEvent<LynxNode, LynxNode<"input">>>;
	/** `selection`, in a main-thread function. */
	"main-thread:onselection"?: MainThreadEventHandler<LynxInputSelectionEvent<MainThread.Element>>;
	/** `selection`, in a main-thread function, in the capture phase. */
	"main-thread:onselectioncapture"?: MainThreadEventHandler<
		LynxInputSelectionEvent<MainThread.Element>
	>;
	/** `selection`, in a main-thread function, caught here. */
	"main-thread:oncatchselection"?: MainThreadEventHandler<
		LynxInputSelectionEvent<MainThread.Element>
	>;
	/** `selection`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchselectioncapture"?: MainThreadEventHandler<
		LynxInputSelectionEvent<MainThread.Element>
	>;
}

/** The events `<input>` sends, by name, as its listeners hear them. */
export interface LynxInputEvents extends LynxCommonEvents<"input"> {
	/** Focused */
	focus: LynxInputFocusEvent<LynxNode, LynxNode<"input">>;
	/** Blurred */
	blur: LynxInputBlurEvent<LynxNode, LynxNode<"input">>;
	/** Confirm button clicked */
	confirm: LynxInputConfirmEvent<LynxNode, LynxNode<"input">>;
	/** Input content changed */
	input: LynxInputEvent<LynxNode, LynxNode<"input">>;
	/** Input selection changed */
	selection: LynxInputSelectionEvent<LynxNode, LynxNode<"input">>;
}

/** The attributes and events of `<textarea>`. */
export interface LynxTextareaAttributes extends LynxCommonAttributes<"textarea"> {
	/**
	 * Keep the editor focused after confirmation instead of dismissing the keyboard.
	 * The next action still performs native focus traversal.
	 * @defaultValue false
	 */
	"confirm-enter"?: boolean | null;
	/** Placeholder */
	placeholder?: string | null;
	/** Initial textarea content. Only applies on the first render and does not trigger `oninput`. */
	"default-value"?: string | null;
	/**
	 * The type of confirm button
	 * @defaultValue 'done'
	 */
	"confirm-type"?: "search" | "send" | "go" | "done" | "next" | null;
	/**
	 * Max input length
	 * @defaultValue 140
	 */
	maxlength?: number | null;
	/**
	 * Max input lines
	 * @defaultValue undefined
	 */
	maxlines?: number | null;
	/**
	 * Bounce effect for iOS
	 * @defaultValue true
	 */
	bounces?: boolean | null;
	/**
	 * Line spacing
	 * @defaultValue undefined
	 */
	"line-spacing"?: number | `${number}px` | `${number}rpx` | null;
	/**
	 * Readonly
	 * @defaultValue false
	 */
	readonly?: boolean | null;
	/**
	 * Interaction enabled
	 * @defaultValue false
	 */
	disabled?: boolean | null;
	/**
	 * Show soft input keyboard while focused
	 * @defaultValue true
	 */
	"show-soft-input-on-focus"?: boolean | null;
	/**
	 * Sets how the host avoids the soft keyboard.
	 *
	 * - `unspecified`: Uses the platform default behavior.
	 * - `nothing`: Leaves the host window or page unchanged when the keyboard appears.
	 * - `pan`: Moves the host content to keep the focused textarea visible.
	 * - `resize`: Resizes the host content to fit above the keyboard.
	 *
	 * This setting affects the owning Android window or Harmony UI context, including
	 * sibling views that share it. It is not restored automatically when this textarea
	 * loses focus or is removed. Omitting the property leaves the current host setting
	 * unchanged. Unsupported strings fall back to `unspecified`.
	 *
	 * This property is independent of `avoid-keyboard`, which controls Lynx's own
	 * keyboard avoidance. On Android, `android-set-soft-input-mode` remains available
	 * as a compatibility alias. Harmony support requires API 14 or later.
	 */
	"set-soft-input-mode"?: "unspecified" | "nothing" | "pan" | "resize" | null;
	/**
	 * Filter the input content and process it in the form of regular expressions
	 * @defaultValue undefined
	 */
	"input-filter"?: string | null;
	/**
	 * Whether to show scroll bar, on HarmonyOS, the scroll bar will always be shown
	 * @defaultValue false
	 */
	"enable-scroll-bar"?: boolean | null;
	/**
	 * Input content type
	 * @defaultValue "text"
	 */
	type?: "number" | "text" | "digit" | "tel" | "email" | null;
	/**
	 * Auto correct input content on iOS
	 * @defaultValue true
	 */
	"ios-auto-correct"?: boolean | null;
	/**
	 * Check spelling issue on iOS
	 * @defaultValue true
	 */
	"ios-spell-check"?: boolean | null;
	/**
	 * Whether to enter the full-screen input mode when in landscape screen, in which the keyboard and input box will take up the entire screen
	 * @defaultValue true
	 */
	"android-fullscreen-mode"?: boolean | null;
	/** The text in the field, as on the web: write it back in `oninput` (`oninput={(event) => (text = event.detail.value)}`). */
	value?: string | null;
	/** Focused */
	onfocus?: LynxEventHandler<LynxTextAreaFocusEvent<LynxNode, LynxNode<"textarea">>>;
	/** `focus`, heard in the capture phase: before the elements inside. */
	onfocuscapture?: LynxEventHandler<LynxTextAreaFocusEvent<LynxNode, LynxNode<"textarea">>>;
	/** `focus`, caught here: the elements this is inside do not hear it. */
	oncatchfocus?: LynxEventHandler<LynxTextAreaFocusEvent<LynxNode, LynxNode<"textarea">>>;
	/** `focus`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfocuscapture?: LynxEventHandler<LynxTextAreaFocusEvent<LynxNode, LynxNode<"textarea">>>;
	/** `focus`, in a main-thread function. */
	"main-thread:onfocus"?: MainThreadEventHandler<LynxTextAreaFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, in the capture phase. */
	"main-thread:onfocuscapture"?: MainThreadEventHandler<LynxTextAreaFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught here. */
	"main-thread:oncatchfocus"?: MainThreadEventHandler<LynxTextAreaFocusEvent<MainThread.Element>>;
	/** `focus`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfocuscapture"?: MainThreadEventHandler<
		LynxTextAreaFocusEvent<MainThread.Element>
	>;
	/** Blurred */
	onblur?: LynxEventHandler<LynxTextAreaBlurEvent<LynxNode, LynxNode<"textarea">>>;
	/** `blur`, heard in the capture phase: before the elements inside. */
	onblurcapture?: LynxEventHandler<LynxTextAreaBlurEvent<LynxNode, LynxNode<"textarea">>>;
	/** `blur`, caught here: the elements this is inside do not hear it. */
	oncatchblur?: LynxEventHandler<LynxTextAreaBlurEvent<LynxNode, LynxNode<"textarea">>>;
	/** `blur`, caught in the capture phase: the elements inside do not hear it. */
	oncatchblurcapture?: LynxEventHandler<LynxTextAreaBlurEvent<LynxNode, LynxNode<"textarea">>>;
	/** `blur`, in a main-thread function. */
	"main-thread:onblur"?: MainThreadEventHandler<LynxTextAreaBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, in the capture phase. */
	"main-thread:onblurcapture"?: MainThreadEventHandler<LynxTextAreaBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught here. */
	"main-thread:oncatchblur"?: MainThreadEventHandler<LynxTextAreaBlurEvent<MainThread.Element>>;
	/** `blur`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchblurcapture"?: MainThreadEventHandler<
		LynxTextAreaBlurEvent<MainThread.Element>
	>;
	/** Input content changed */
	oninput?: LynxEventHandler<LynxTextAreaInputEvent<LynxNode, LynxNode<"textarea">>>;
	/** `input`, heard in the capture phase: before the elements inside. */
	oninputcapture?: LynxEventHandler<LynxTextAreaInputEvent<LynxNode, LynxNode<"textarea">>>;
	/** `input`, caught here: the elements this is inside do not hear it. */
	oncatchinput?: LynxEventHandler<LynxTextAreaInputEvent<LynxNode, LynxNode<"textarea">>>;
	/** `input`, caught in the capture phase: the elements inside do not hear it. */
	oncatchinputcapture?: LynxEventHandler<LynxTextAreaInputEvent<LynxNode, LynxNode<"textarea">>>;
	/** `input`, in a main-thread function. */
	"main-thread:oninput"?: MainThreadEventHandler<LynxTextAreaInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, in the capture phase. */
	"main-thread:oninputcapture"?: MainThreadEventHandler<LynxTextAreaInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, caught here. */
	"main-thread:oncatchinput"?: MainThreadEventHandler<LynxTextAreaInputEvent<MainThread.Element>>;
	/** `input`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchinputcapture"?: MainThreadEventHandler<
		LynxTextAreaInputEvent<MainThread.Element>
	>;
	/** Input selection changed */
	onselection?: LynxEventHandler<LynxTextAreaSelectionChangeEvent<LynxNode, LynxNode<"textarea">>>;
	/** `selection`, heard in the capture phase: before the elements inside. */
	onselectioncapture?: LynxEventHandler<
		LynxTextAreaSelectionChangeEvent<LynxNode, LynxNode<"textarea">>
	>;
	/** `selection`, caught here: the elements this is inside do not hear it. */
	oncatchselection?: LynxEventHandler<
		LynxTextAreaSelectionChangeEvent<LynxNode, LynxNode<"textarea">>
	>;
	/** `selection`, caught in the capture phase: the elements inside do not hear it. */
	oncatchselectioncapture?: LynxEventHandler<
		LynxTextAreaSelectionChangeEvent<LynxNode, LynxNode<"textarea">>
	>;
	/** `selection`, in a main-thread function. */
	"main-thread:onselection"?: MainThreadEventHandler<
		LynxTextAreaSelectionChangeEvent<MainThread.Element>
	>;
	/** `selection`, in a main-thread function, in the capture phase. */
	"main-thread:onselectioncapture"?: MainThreadEventHandler<
		LynxTextAreaSelectionChangeEvent<MainThread.Element>
	>;
	/** `selection`, in a main-thread function, caught here. */
	"main-thread:oncatchselection"?: MainThreadEventHandler<
		LynxTextAreaSelectionChangeEvent<MainThread.Element>
	>;
	/** `selection`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchselectioncapture"?: MainThreadEventHandler<
		LynxTextAreaSelectionChangeEvent<MainThread.Element>
	>;
	/** Confirm button clicked, only work when confirm-type is defined */
	onconfirm?: LynxEventHandler<LynxTextAreaConfirmEvent<LynxNode, LynxNode<"textarea">>>;
	/** `confirm`, heard in the capture phase: before the elements inside. */
	onconfirmcapture?: LynxEventHandler<LynxTextAreaConfirmEvent<LynxNode, LynxNode<"textarea">>>;
	/** `confirm`, caught here: the elements this is inside do not hear it. */
	oncatchconfirm?: LynxEventHandler<LynxTextAreaConfirmEvent<LynxNode, LynxNode<"textarea">>>;
	/** `confirm`, caught in the capture phase: the elements inside do not hear it. */
	oncatchconfirmcapture?: LynxEventHandler<
		LynxTextAreaConfirmEvent<LynxNode, LynxNode<"textarea">>
	>;
	/** `confirm`, in a main-thread function. */
	"main-thread:onconfirm"?: MainThreadEventHandler<LynxTextAreaConfirmEvent<MainThread.Element>>;
	/** `confirm`, in a main-thread function, in the capture phase. */
	"main-thread:onconfirmcapture"?: MainThreadEventHandler<
		LynxTextAreaConfirmEvent<MainThread.Element>
	>;
	/** `confirm`, in a main-thread function, caught here. */
	"main-thread:oncatchconfirm"?: MainThreadEventHandler<
		LynxTextAreaConfirmEvent<MainThread.Element>
	>;
	/** `confirm`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchconfirmcapture"?: MainThreadEventHandler<
		LynxTextAreaConfirmEvent<MainThread.Element>
	>;
}

/** The events `<textarea>` sends, by name, as its listeners hear them. */
export interface LynxTextareaEvents extends LynxCommonEvents<"textarea"> {
	/** Focused */
	focus: LynxTextAreaFocusEvent<LynxNode, LynxNode<"textarea">>;
	/** Blurred */
	blur: LynxTextAreaBlurEvent<LynxNode, LynxNode<"textarea">>;
	/** Input content changed */
	input: LynxTextAreaInputEvent<LynxNode, LynxNode<"textarea">>;
	/** Input selection changed */
	selection: LynxTextAreaSelectionChangeEvent<LynxNode, LynxNode<"textarea">>;
	/** Confirm button clicked, only work when confirm-type is defined */
	confirm: LynxTextAreaConfirmEvent<LynxNode, LynxNode<"textarea">>;
}

/** The attributes and events of `<overlay>`. */
export interface LynxOverlayAttributes
	extends LynxCommonAttributes<"overlay">, LynxDefaultAttributes<"overlay"> {
	/**
	 * Keeps a global overlay displayed when its authored view detaches.
	 * Set to false to hide the overlay on detach. Fragment-scoped overlays follow their owner.
	 * @defaultValue true
	 */
	"always-show"?: boolean | null;
	/**
	 * Uses the bounds selected by mode and follows changes to those bounds.
	 * Available starting with 4.3 prereleases.
	 * @defaultValue false
	 */
	"ios-follow-mode-edge"?: boolean | null;
	/**
	 * ID selector of the nested scroll view used to coordinate overlay gesture handling.
	 * @defaultValue Unset; no nested scroll-view ID is configured.
	 */
	"nest-scroll"?: string | null;
	/**
	 * Control whether the overlay is displayed
	 * @defaultValue false
	 */
	visible?: boolean | null;
	/**
	 * Sets the Android navigation bar background and contrasting system-bar appearance. `auto` inherits the host Activity navigation bar.
	 * When set to `transparent`, `android-adapt-edge-to-edge` must also be set to `true`.
	 * @defaultValue 'auto'
	 */
	"android-navigation-bar-style"?: "auto" | "light" | "dark" | "transparent" | null;
	/**
	 * Scopes Android overlay visibility to the Fragment that owns its LynxView.
	 * @defaultValue 'global'
	 */
	"android-overlay-scope"?: "global" | "fragment" | null;
	/**
	 * Introduces the concept of layers, which are divided into four levels. The larger the layer, the closer it is to the bottom. By default, it is the first level. The layers are arranged in order from 1 to 4. The displayed layer is specified and is not affected by the order of display. Within each layer, the arrangement is based on the 'last in, first out' logic. The layer cannot be dynamically adjusted when the overlay is displayed, and can only be adjusted when it is hidden. *
	 * @defaultValue 1
	 */
	level?: 1 | 2 | 3 | 4 | null;
	/**
	 * When overlay is displayed, 'true' allows swiping right to close the current page, 'false' does not allow it
	 * @defaultValue false
	 */
	"ios-enable-swipe-back"?: boolean | null;
	/**
	 * Specifies the level at which overlay content resides. On iOS, window mounts on the app window, top mounts on the topViewController, page mounts on UINavigationController, and other strings customize the client class name. On Harmony native overlay, page embeds in the current page; window, top, missing, and other strings use the default window-like overlay level.
	 * @defaultValue 'window'
	 */
	mode?: string | null;
	/**
	 * Whether a touch outside the overlay's children reaches the page below it.
	 *
	 * @workaround overlay-events-pass-through kind=lynx-gap delete-when="@lynx-js/types declares events-pass-through on <overlay>: remove it from scripts/types/additions.ts"
	 */
	"events-pass-through"?: boolean | null;
	/** Callback when the overlay is displayed */
	onshowoverlay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `showoverlay`, heard in the capture phase: before the elements inside. */
	onshowoverlaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `showoverlay`, caught here: the elements this is inside do not hear it. */
	oncatchshowoverlay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `showoverlay`, caught in the capture phase: the elements inside do not hear it. */
	oncatchshowoverlaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `showoverlay`, in a main-thread function. */
	"main-thread:onshowoverlay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `showoverlay`, in a main-thread function, in the capture phase. */
	"main-thread:onshowoverlaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `showoverlay`, in a main-thread function, caught here. */
	"main-thread:oncatchshowoverlay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `showoverlay`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchshowoverlaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Callback when the overlay is hidden. */
	ondismissoverlay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `dismissoverlay`, heard in the capture phase: before the elements inside. */
	ondismissoverlaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `dismissoverlay`, caught here: the elements this is inside do not hear it. */
	oncatchdismissoverlay?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `dismissoverlay`, caught in the capture phase: the elements inside do not hear it. */
	oncatchdismissoverlaycapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `dismissoverlay`, in a main-thread function. */
	"main-thread:ondismissoverlay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `dismissoverlay`, in a main-thread function, in the capture phase. */
	"main-thread:ondismissoverlaycapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `dismissoverlay`, in a main-thread function, caught here. */
	"main-thread:oncatchdismissoverlay"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `dismissoverlay`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchdismissoverlaycapture"?: MainThreadEventHandler<
		LynxEvent<MainThread.Element>
	>;
	/** The overlay is asked to close: Android's Back button, or a swipe from the screen's edge on iOS. Lynx names the event `requestclose` on Android and `onRequestClose` on iOS, and this hears both. */
	onrequestclose?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `requestclose`, heard in the capture phase: before the elements inside. */
	onrequestclosecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `requestclose`, caught here: the elements this is inside do not hear it. */
	oncatchrequestclose?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `requestclose`, caught in the capture phase: the elements inside do not hear it. */
	oncatchrequestclosecapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"overlay">>>;
	/** `requestclose`, in a main-thread function. */
	"main-thread:onrequestclose"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `requestclose`, in a main-thread function, in the capture phase. */
	"main-thread:onrequestclosecapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `requestclose`, in a main-thread function, caught here. */
	"main-thread:oncatchrequestclose"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `requestclose`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchrequestclosecapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Callback when touch on the overlay */
	onoverlaytouch?: LynxEventHandler<LynxOverlayTouchEvent<LynxNode, LynxNode<"overlay">>>;
	/** `overlaytouch`, heard in the capture phase: before the elements inside. */
	onoverlaytouchcapture?: LynxEventHandler<LynxOverlayTouchEvent<LynxNode, LynxNode<"overlay">>>;
	/** `overlaytouch`, caught here: the elements this is inside do not hear it. */
	oncatchoverlaytouch?: LynxEventHandler<LynxOverlayTouchEvent<LynxNode, LynxNode<"overlay">>>;
	/** `overlaytouch`, caught in the capture phase: the elements inside do not hear it. */
	oncatchoverlaytouchcapture?: LynxEventHandler<
		LynxOverlayTouchEvent<LynxNode, LynxNode<"overlay">>
	>;
	/** `overlaytouch`, in a main-thread function. */
	"main-thread:onoverlaytouch"?: MainThreadEventHandler<LynxOverlayTouchEvent<MainThread.Element>>;
	/** `overlaytouch`, in a main-thread function, in the capture phase. */
	"main-thread:onoverlaytouchcapture"?: MainThreadEventHandler<
		LynxOverlayTouchEvent<MainThread.Element>
	>;
	/** `overlaytouch`, in a main-thread function, caught here. */
	"main-thread:oncatchoverlaytouch"?: MainThreadEventHandler<
		LynxOverlayTouchEvent<MainThread.Element>
	>;
	/** `overlaytouch`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchoverlaytouchcapture"?: MainThreadEventHandler<
		LynxOverlayTouchEvent<MainThread.Element>
	>;
	/** Callback when touch on the overlay */
	onerror?: LynxEventHandler<LynxOverlayErrorEvent<LynxNode, LynxNode<"overlay">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxOverlayErrorEvent<LynxNode, LynxNode<"overlay">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxOverlayErrorEvent<LynxNode, LynxNode<"overlay">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<LynxOverlayErrorEvent<LynxNode, LynxNode<"overlay">>>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxOverlayErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<LynxOverlayErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<LynxOverlayErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<
		LynxOverlayErrorEvent<MainThread.Element>
	>;
}

/** The events `<overlay>` sends, by name, as its listeners hear them. */
export interface LynxOverlayEvents
	extends LynxCommonEvents<"overlay">, LynxDefaultEvents<"overlay"> {
	/** Callback when the overlay is displayed */
	showoverlay: LynxEvent<LynxNode, LynxNode<"overlay">>;
	/** Callback when the overlay is hidden. */
	dismissoverlay: LynxEvent<LynxNode, LynxNode<"overlay">>;
	/** The overlay is asked to close: Android's Back button, or a swipe from the screen's edge on iOS. Lynx names the event `requestclose` on Android and `onRequestClose` on iOS, and this hears both. */
	requestclose: LynxEvent<LynxNode, LynxNode<"overlay">>;
	/** Callback when touch on the overlay */
	overlaytouch: LynxOverlayTouchEvent<LynxNode, LynxNode<"overlay">>;
	/** Callback when touch on the overlay */
	error: LynxOverlayErrorEvent<LynxNode, LynxNode<"overlay">>;
}

/** The attributes and events of `<svg>`. */
export interface LynxSvgAttributes
	extends LynxCommonAttributes<"svg">, LynxDefaultAttributes<"svg"> {
	/** SVG resource URL */
	src?: string | null;
	/** SVG XML content */
	content?: string | null;
	/**
	 * Host-injected default color used to resolve `currentColor` in SVG content.
	 * This does not override explicit `fill` or `stroke` values.
	 */
	"current-color"?: string | null;
	/** SVG Loaded */
	onload?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"svg">>>;
	/** `load`, heard in the capture phase: before the elements inside. */
	onloadcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"svg">>>;
	/** `load`, caught here: the elements this is inside do not hear it. */
	oncatchload?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"svg">>>;
	/** `load`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloadcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"svg">>>;
	/** `load`, in a main-thread function. */
	"main-thread:onload"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, in the capture phase. */
	"main-thread:onloadcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught here. */
	"main-thread:oncatchload"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloadcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
}

/** The events `<svg>` sends, by name, as its listeners hear them. */
export interface LynxSvgEvents extends LynxCommonEvents<"svg">, LynxDefaultEvents<"svg"> {
	/** SVG Loaded */
	load: LynxEvent<LynxNode, LynxNode<"svg">>;
}

/** The attributes and events of `<title-bar-view>`. */
export interface LynxTitleBarViewAttributes
	extends LynxCommonAttributes<"title-bar-view">, LynxDefaultAttributes<"title-bar-view"> {
	/**
	 * When set to true, the title bar view is able to move the window when dragged.
	 * @defaultValue false
	 */
	moveable?: boolean | null;
}

/** The events `<title-bar-view>` sends, by name, as its listeners hear them. */
export interface LynxTitleBarViewEvents
	extends LynxCommonEvents<"title-bar-view">, LynxDefaultEvents<"title-bar-view"> {}

/** The attributes and events of `<refresh>`. */
export interface LynxRefreshAttributes
	extends LynxCommonAttributes<"refresh">, LynxDefaultAttributes<"refresh"> {
	/**
	 * Determines if dragging down or calling autoStartRefresh can trigger the startrefresh event.
	 * @defaultValue true
	 */
	"enable-refresh"?: boolean | null;
	/** Triggered when enable-refresh is true, and dragging down or calling autoStartRefresh (enters refresh state). */
	onstartrefresh?: LynxEventHandler<LynxRefreshStartRefreshEvent<LynxNode, LynxNode<"refresh">>>;
	/** `startrefresh`, heard in the capture phase: before the elements inside. */
	onstartrefreshcapture?: LynxEventHandler<
		LynxRefreshStartRefreshEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `startrefresh`, caught here: the elements this is inside do not hear it. */
	oncatchstartrefresh?: LynxEventHandler<
		LynxRefreshStartRefreshEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `startrefresh`, caught in the capture phase: the elements inside do not hear it. */
	oncatchstartrefreshcapture?: LynxEventHandler<
		LynxRefreshStartRefreshEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `startrefresh`, in a main-thread function. */
	"main-thread:onstartrefresh"?: MainThreadEventHandler<
		LynxRefreshStartRefreshEvent<MainThread.Element>
	>;
	/** `startrefresh`, in a main-thread function, in the capture phase. */
	"main-thread:onstartrefreshcapture"?: MainThreadEventHandler<
		LynxRefreshStartRefreshEvent<MainThread.Element>
	>;
	/** `startrefresh`, in a main-thread function, caught here. */
	"main-thread:oncatchstartrefresh"?: MainThreadEventHandler<
		LynxRefreshStartRefreshEvent<MainThread.Element>
	>;
	/** `startrefresh`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchstartrefreshcapture"?: MainThreadEventHandler<
		LynxRefreshStartRefreshEvent<MainThread.Element>
	>;
	/** Triggered during movement when `<refresh-header>` is exposed. */
	onheaderoffset?: LynxEventHandler<LynxRefreshHeaderOffsetEvent<LynxNode, LynxNode<"refresh">>>;
	/** `headeroffset`, heard in the capture phase: before the elements inside. */
	onheaderoffsetcapture?: LynxEventHandler<
		LynxRefreshHeaderOffsetEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `headeroffset`, caught here: the elements this is inside do not hear it. */
	oncatchheaderoffset?: LynxEventHandler<
		LynxRefreshHeaderOffsetEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `headeroffset`, caught in the capture phase: the elements inside do not hear it. */
	oncatchheaderoffsetcapture?: LynxEventHandler<
		LynxRefreshHeaderOffsetEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `headeroffset`, in a main-thread function. */
	"main-thread:onheaderoffset"?: MainThreadEventHandler<
		LynxRefreshHeaderOffsetEvent<MainThread.Element>
	>;
	/** `headeroffset`, in a main-thread function, in the capture phase. */
	"main-thread:onheaderoffsetcapture"?: MainThreadEventHandler<
		LynxRefreshHeaderOffsetEvent<MainThread.Element>
	>;
	/** `headeroffset`, in a main-thread function, caught here. */
	"main-thread:oncatchheaderoffset"?: MainThreadEventHandler<
		LynxRefreshHeaderOffsetEvent<MainThread.Element>
	>;
	/** `headeroffset`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchheaderoffsetcapture"?: MainThreadEventHandler<
		LynxRefreshHeaderOffsetEvent<MainThread.Element>
	>;
	/** Triggered when `<refresh-header>` state changes. */
	onrefreshstatechange?: LynxEventHandler<
		LynxRefreshStateChangeEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `refreshstatechange`, heard in the capture phase: before the elements inside. */
	onrefreshstatechangecapture?: LynxEventHandler<
		LynxRefreshStateChangeEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `refreshstatechange`, caught here: the elements this is inside do not hear it. */
	oncatchrefreshstatechange?: LynxEventHandler<
		LynxRefreshStateChangeEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `refreshstatechange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchrefreshstatechangecapture?: LynxEventHandler<
		LynxRefreshStateChangeEvent<LynxNode, LynxNode<"refresh">>
	>;
	/** `refreshstatechange`, in a main-thread function. */
	"main-thread:onrefreshstatechange"?: MainThreadEventHandler<
		LynxRefreshStateChangeEvent<MainThread.Element>
	>;
	/** `refreshstatechange`, in a main-thread function, in the capture phase. */
	"main-thread:onrefreshstatechangecapture"?: MainThreadEventHandler<
		LynxRefreshStateChangeEvent<MainThread.Element>
	>;
	/** `refreshstatechange`, in a main-thread function, caught here. */
	"main-thread:oncatchrefreshstatechange"?: MainThreadEventHandler<
		LynxRefreshStateChangeEvent<MainThread.Element>
	>;
	/** `refreshstatechange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchrefreshstatechangecapture"?: MainThreadEventHandler<
		LynxRefreshStateChangeEvent<MainThread.Element>
	>;
}

/** The events `<refresh>` sends, by name, as its listeners hear them. */
export interface LynxRefreshEvents
	extends LynxCommonEvents<"refresh">, LynxDefaultEvents<"refresh"> {
	/** Triggered when enable-refresh is true, and dragging down or calling autoStartRefresh (enters refresh state). */
	startrefresh: LynxRefreshStartRefreshEvent<LynxNode, LynxNode<"refresh">>;
	/** Triggered during movement when `<refresh-header>` is exposed. */
	headeroffset: LynxRefreshHeaderOffsetEvent<LynxNode, LynxNode<"refresh">>;
	/** Triggered when `<refresh-header>` state changes. */
	refreshstatechange: LynxRefreshStateChangeEvent<LynxNode, LynxNode<"refresh">>;
}

/** The attributes and events of `<refresh-header>`. */
export interface LynxRefreshHeaderAttributes
	extends LynxCommonAttributes<"refresh-header">, LynxDefaultAttributes<"refresh-header"> {}

/** The events `<refresh-header>` sends, by name, as its listeners hear them. */
export interface LynxRefreshHeaderEvents
	extends LynxCommonEvents<"refresh-header">, LynxDefaultEvents<"refresh-header"> {}

/** The attributes and events of `<scroll-coordinator>`. */
export interface LynxScrollCoordinatorAttributes
	extends LynxCommonAttributes<"scroll-coordinator">, LynxDefaultAttributes<"scroll-coordinator"> {
	/**
	 * Initial support was backported; component registration differs across later release branches.
	 * Comma-separated native scroll-view names to exclude from nested-scroll discovery.
	 * @defaultValue Unset; no scroll-view names are excluded by this attribute.
	 */
	"ios-scroll-exclude"?: string | null;
	/**
	 * Initial support was backported; component registration differs across later release branches.
	 * Minimum nested scroll-view height as a fraction of the available slot height when selecting the scroll view to coordinate.
	 * @defaultValue 0.5
	 */
	"ios-scroll-view-filter"?: number | null;
	/**
	 * When the user taps the status bar, the scroll view beneath the touch which is closest to the status bar will be scrolled to top. iOS feature only.
	 * @defaultValue false
	 */
	"ios-scrolls-to-top"?: boolean | null;
	/**
	 * This property controls whether the header hierarchy higher than the slot, when header is overflow, it will be displayed on top of the slot. Otherwise, it will be displayed below the slot. It is better to set this property explicitly, rather than use the default value.
	 * @defaultValue false
	 */
	"header-over-slot"?: boolean | null;
	/**
	 * Set whether the coordinator can scroll vertically.
	 * @defaultValue true
	 */
	"enable-scroll"?: boolean | null;
	/**
	 * Enable the bounce effect when the coordinator scrolls past its boundary.
	 * @defaultValue true
	 */
	bounces?: boolean | null;
	/**
	 * Set whether the scrollbar is visible during coordinator scrolling.
	 * @defaultValue false
	 */
	"enable-scroll-bar"?: boolean | null;
	/**
	 * Adapt the Android coordinator offset when the active slot is empty or is shorter than the app bar and cannot scroll vertically.
	 * @defaultValue false
	 */
	"android-adapt-to-empty-slot"?: boolean | null;
	/**
	 * Android foldview is based on CoordinateLayout, but it only implements NestedScrollingParent, so it not support to nested scroll as child in other scrolling widget, set this property true to make it work.
	 * @defaultValue false
	 */
	"android-nested-scroll-as-child"?: boolean | null;
	/**
	 * Whether to force the nested-vertical-scroll-behavior invalid of foldview on iOS, the setting is ineffective for other platforms
	 * @defaultValue false
	 */
	"ios-force-scroll-detach"?: boolean | null;
	/**
	 * The event response granularity of onoffset, once the scroll distance exceeds the scrollable distance of granularity, it may trigger. It defaults to 0.01, but it doesn't necessarily trigger every 0.01.
	 * @defaultValue 0.01
	 */
	granularity?: number | null;
	/**
	 * The pull-to-refresh mode of foldview, none (none, default value), page (category pull-to-refresh), fold (overall pull-to-refresh)
	 * @defaultValue 'none'
	 */
	"refresh-mode"?: "none" | "page" | "fold" | null;
	/** Callback for folding progress */
	onoffset?: LynxEventHandler<
		LynxScrollCoordinatorOffsetEvent<LynxNode, LynxNode<"scroll-coordinator">>
	>;
	/** `offset`, heard in the capture phase: before the elements inside. */
	onoffsetcapture?: LynxEventHandler<
		LynxScrollCoordinatorOffsetEvent<LynxNode, LynxNode<"scroll-coordinator">>
	>;
	/** `offset`, caught here: the elements this is inside do not hear it. */
	oncatchoffset?: LynxEventHandler<
		LynxScrollCoordinatorOffsetEvent<LynxNode, LynxNode<"scroll-coordinator">>
	>;
	/** `offset`, caught in the capture phase: the elements inside do not hear it. */
	oncatchoffsetcapture?: LynxEventHandler<
		LynxScrollCoordinatorOffsetEvent<LynxNode, LynxNode<"scroll-coordinator">>
	>;
	/** `offset`, in a main-thread function. */
	"main-thread:onoffset"?: MainThreadEventHandler<
		LynxScrollCoordinatorOffsetEvent<MainThread.Element>
	>;
	/** `offset`, in a main-thread function, in the capture phase. */
	"main-thread:onoffsetcapture"?: MainThreadEventHandler<
		LynxScrollCoordinatorOffsetEvent<MainThread.Element>
	>;
	/** `offset`, in a main-thread function, caught here. */
	"main-thread:oncatchoffset"?: MainThreadEventHandler<
		LynxScrollCoordinatorOffsetEvent<MainThread.Element>
	>;
	/** `offset`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchoffsetcapture"?: MainThreadEventHandler<
		LynxScrollCoordinatorOffsetEvent<MainThread.Element>
	>;
}

/** The events `<scroll-coordinator>` sends, by name, as its listeners hear them. */
export interface LynxScrollCoordinatorEvents
	extends LynxCommonEvents<"scroll-coordinator">, LynxDefaultEvents<"scroll-coordinator"> {
	/** Callback for folding progress */
	offset: LynxScrollCoordinatorOffsetEvent<LynxNode, LynxNode<"scroll-coordinator">>;
}

/** The attributes and events of `<scroll-coordinator-header>`. */
export interface LynxScrollCoordinatorHeaderAttributes
	extends
		LynxCommonAttributes<"scroll-coordinator-header">,
		LynxDefaultAttributes<"scroll-coordinator-header"> {
	/**
	 * Keep gestures in the header with its children instead of allowing the parent to intercept them.
	 * @defaultValue false
	 */
	"android-consume-gesture"?: boolean | null;
}

/** The events `<scroll-coordinator-header>` sends, by name, as its listeners hear them. */
export interface LynxScrollCoordinatorHeaderEvents
	extends
		LynxCommonEvents<"scroll-coordinator-header">,
		LynxDefaultEvents<"scroll-coordinator-header"> {}

/** The attributes and events of `<scroll-coordinator-slot>`. */
export interface LynxScrollCoordinatorSlotAttributes
	extends
		LynxCommonAttributes<"scroll-coordinator-slot">,
		LynxDefaultAttributes<"scroll-coordinator-slot"> {}

/** The events `<scroll-coordinator-slot>` sends, by name, as its listeners hear them. */
export interface LynxScrollCoordinatorSlotEvents
	extends
		LynxCommonEvents<"scroll-coordinator-slot">,
		LynxDefaultEvents<"scroll-coordinator-slot"> {}

/** The attributes and events of `<scroll-coordinator-slot-drag>`. */
export interface LynxScrollCoordinatorSlotDragAttributes
	extends
		LynxCommonAttributes<"scroll-coordinator-slot-drag">,
		LynxDefaultAttributes<"scroll-coordinator-slot-drag"> {
	/**
	 * Whether to allow drag-ng to respond to up and down dragging gestures
	 * @defaultValue true
	 */
	"enable-drag"?: boolean | null;
}

/** The events `<scroll-coordinator-slot-drag>` sends, by name, as its listeners hear them. */
export interface LynxScrollCoordinatorSlotDragEvents
	extends
		LynxCommonEvents<"scroll-coordinator-slot-drag">,
		LynxDefaultEvents<"scroll-coordinator-slot-drag"> {}

/** The attributes and events of `<scroll-coordinator-toolbar>`. */
export interface LynxScrollCoordinatorToolbarAttributes
	extends
		LynxCommonAttributes<"scroll-coordinator-toolbar">,
		LynxDefaultAttributes<"scroll-coordinator-toolbar"> {}

/** The events `<scroll-coordinator-toolbar>` sends, by name, as its listeners hear them. */
export interface LynxScrollCoordinatorToolbarEvents
	extends
		LynxCommonEvents<"scroll-coordinator-toolbar">,
		LynxDefaultEvents<"scroll-coordinator-toolbar"> {}

/** The attributes and events of `<viewpager>`. */
export interface LynxViewpagerAttributes
	extends LynxCommonAttributes<"viewpager">, LynxDefaultAttributes<"viewpager"> {
	/**
	 * UIView's tag, be used to identify the UIView of the UIGestureRecognizer which identified by `ios-recognized-gesture-class`. This property is designed to let an UIPanGesture work together with viewpager.
	 * @defaultValue 0
	 */
	"ios-recognized-view-tag"?: number | null;
	/** UIGestureRecognizer's class name, be used to identify the UIGestureRecognizer which may be recognized simultaneously with viewpager. This property is designed to let an UIPanGesture work together with viewpager. */
	"ios-recognized-gesture-class"?: string | null;
	/**
	 * Select the specified page at initialization, specifically referring to the first time when there are children.
	 * @defaultValue 0
	 */
	"initial-select-index"?: number | null;
	/**
	 * Enable horizontal scroll gesture
	 * @defaultValue true
	 */
	"enable-scroll"?: boolean | null;
	/**
	 * Is a spring effect needed. Note that this effect is not available on Android. On PC, only macOS support this feature.
	 * @defaultValue true
	 */
	bounces?: boolean | null;
	/**
	 * When the finger touches within [0, value] from the left edge of the screen, it doesn't respond to the horizontal swipe gesture, but it can directly respond to the iOS right swipe to return gesture. However, it's not applicable to Android.
	 * @defaultValue 0
	 */
	"ios-gesture-offset"?: number | null;
	/**
	 * When enabled, when sliding to the head or tail, it can respond to the horizontal swipe events of the outer container (horizontal UIScrollView)
	 * @defaultValue false
	 */
	"ios-gesture-direction"?: boolean | null;
	/**
	 * Whether to enable the lazy load mode based on early exposure, it needs to be used in conjunction with the lazyComponent.
	 * @defaultValue false
	 */
	"keep-item-view"?: boolean | null;
	/**
	 * On Android, this attribute is used to control the interaction behavior when scrolling to the edges. Setting it to true enables the default bounce effect, while setting it to false disables the bounce effect. The default value is false.
	 * @defaultValue false
	 */
	"android-always-overscroll"?: boolean | null;
	/**
	 * On Android, this attribute is used to control if at start/end of viewpager and set true, gesture can not pass to parent.
	 * @defaultValue false
	 */
	"android-force-can-scroll"?: boolean | null;
	/** Page switch event, it will only be triggered when the UI completely switches to the next page (from 100% to 200%). */
	onchange?: LynxEventHandler<LynxViewPagerChangeEvent<LynxNode, LynxNode<"viewpager">>>;
	/** `change`, heard in the capture phase: before the elements inside. */
	onchangecapture?: LynxEventHandler<LynxViewPagerChangeEvent<LynxNode, LynxNode<"viewpager">>>;
	/** `change`, caught here: the elements this is inside do not hear it. */
	oncatchchange?: LynxEventHandler<LynxViewPagerChangeEvent<LynxNode, LynxNode<"viewpager">>>;
	/** `change`, caught in the capture phase: the elements inside do not hear it. */
	oncatchchangecapture?: LynxEventHandler<
		LynxViewPagerChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `change`, in a main-thread function. */
	"main-thread:onchange"?: MainThreadEventHandler<LynxViewPagerChangeEvent<MainThread.Element>>;
	/** `change`, in a main-thread function, in the capture phase. */
	"main-thread:onchangecapture"?: MainThreadEventHandler<
		LynxViewPagerChangeEvent<MainThread.Element>
	>;
	/** `change`, in a main-thread function, caught here. */
	"main-thread:oncatchchange"?: MainThreadEventHandler<
		LynxViewPagerChangeEvent<MainThread.Element>
	>;
	/** `change`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchchangecapture"?: MainThreadEventHandler<
		LynxViewPagerChangeEvent<MainThread.Element>
	>;
	/** Page switch event, it will be triggered when the page is about to switch, and at this time the UI has not switched to the next page yet, so the offset is still in the range of 0~100% (from page 0 to page 1) or 100%~200% (from page 1 to page 2). */
	onwillchange?: LynxEventHandler<LynxViewPagerWillChangeEvent<LynxNode, LynxNode<"viewpager">>>;
	/** `willchange`, heard in the capture phase: before the elements inside. */
	onwillchangecapture?: LynxEventHandler<
		LynxViewPagerWillChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `willchange`, caught here: the elements this is inside do not hear it. */
	oncatchwillchange?: LynxEventHandler<
		LynxViewPagerWillChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `willchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchwillchangecapture?: LynxEventHandler<
		LynxViewPagerWillChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `willchange`, in a main-thread function. */
	"main-thread:onwillchange"?: MainThreadEventHandler<
		LynxViewPagerWillChangeEvent<MainThread.Element>
	>;
	/** `willchange`, in a main-thread function, in the capture phase. */
	"main-thread:onwillchangecapture"?: MainThreadEventHandler<
		LynxViewPagerWillChangeEvent<MainThread.Element>
	>;
	/** `willchange`, in a main-thread function, caught here. */
	"main-thread:oncatchwillchange"?: MainThreadEventHandler<
		LynxViewPagerWillChangeEvent<MainThread.Element>
	>;
	/** `willchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchwillchangecapture"?: MainThreadEventHandler<
		LynxViewPagerWillChangeEvent<MainThread.Element>
	>;
	/** Page switch progress callback, the range is the index of each page, for example, from page 0 to page 1, it's 0~1, from the first page to the second page, it's 1~2. */
	onoffsetchange?: LynxEventHandler<
		LynxViewPagerOffsetChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `offsetchange`, heard in the capture phase: before the elements inside. */
	onoffsetchangecapture?: LynxEventHandler<
		LynxViewPagerOffsetChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `offsetchange`, caught here: the elements this is inside do not hear it. */
	oncatchoffsetchange?: LynxEventHandler<
		LynxViewPagerOffsetChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `offsetchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchoffsetchangecapture?: LynxEventHandler<
		LynxViewPagerOffsetChangeEvent<LynxNode, LynxNode<"viewpager">>
	>;
	/** `offsetchange`, in a main-thread function. */
	"main-thread:onoffsetchange"?: MainThreadEventHandler<
		LynxViewPagerOffsetChangeEvent<MainThread.Element>
	>;
	/** `offsetchange`, in a main-thread function, in the capture phase. */
	"main-thread:onoffsetchangecapture"?: MainThreadEventHandler<
		LynxViewPagerOffsetChangeEvent<MainThread.Element>
	>;
	/** `offsetchange`, in a main-thread function, caught here. */
	"main-thread:oncatchoffsetchange"?: MainThreadEventHandler<
		LynxViewPagerOffsetChangeEvent<MainThread.Element>
	>;
	/** `offsetchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchoffsetchangecapture"?: MainThreadEventHandler<
		LynxViewPagerOffsetChangeEvent<MainThread.Element>
	>;
}

/** The events `<viewpager>` sends, by name, as its listeners hear them. */
export interface LynxViewpagerEvents
	extends LynxCommonEvents<"viewpager">, LynxDefaultEvents<"viewpager"> {
	/** Page switch event, it will only be triggered when the UI completely switches to the next page (from 100% to 200%). */
	change: LynxViewPagerChangeEvent<LynxNode, LynxNode<"viewpager">>;
	/** Page switch event, it will be triggered when the page is about to switch, and at this time the UI has not switched to the next page yet, so the offset is still in the range of 0~100% (from page 0 to page 1) or 100%~200% (from page 1 to page 2). */
	willchange: LynxViewPagerWillChangeEvent<LynxNode, LynxNode<"viewpager">>;
	/** Page switch progress callback, the range is the index of each page, for example, from page 0 to page 1, it's 0~1, from the first page to the second page, it's 1~2. */
	offsetchange: LynxViewPagerOffsetChangeEvent<LynxNode, LynxNode<"viewpager">>;
}

/** The attributes and events of `<viewpager-item>`. */
export interface LynxViewpagerItemAttributes
	extends LynxCommonAttributes<"viewpager-item">, LynxDefaultAttributes<"viewpager-item"> {}

/** The events `<viewpager-item>` sends, by name, as its listeners hear them. */
export interface LynxViewpagerItemEvents
	extends LynxCommonEvents<"viewpager-item">, LynxDefaultEvents<"viewpager-item"> {}

/** The attributes and events of `<blur-view>`. */
export interface LynxBlurViewAttributes
	extends LynxCommonAttributes<"blur-view">, LynxDefaultAttributes<"blur-view"> {
	/**
	 * Gaussian blur radius.
	 * @defaultValue "0px"
	 */
	"blur-radius"?: string | null;
	/**
	 * The downsampling ratio of the blurred area is similar to reducing the blur of the background area first and then zooming in,
	 * which slightly affects the blur effect, but can significantly improve performance.
	 * @defaultValue 6
	 */
	"blur-sampling"?: number | null;
	/**
	 * Whether to automatically update blur.
	 * @defaultValue true
	 */
	"enable-auto-blur"?: boolean | null;
	/**
	 * The raw id of the Android Lynx view to capture and blur.
	 * Only the overlap with the `<blur-view>` is used as the blur source.
	 * When omitted or unresolved, Android uses the default parent capture path.
	 */
	"android-capture-target"?: string | null;
	/** Switches the Android internal blur-buffer refresh path. */
	"experimental-update-blur-radius"?: boolean | null;
	/**
	 * It mainly affects the brightness of the blurred area:
	 * light: the brightness is basically the same as the background;
	 * dark: the brightness is darker than the background;
	 * extra-light: the brightness is brighter than the background;
	 * glass: a visual effect that renders a glass material;
	 * glass-container: a UIGlassContainerEffect renders multiple glass elements into a combined effect.
	 * @defaultValue 'light'
	 */
	"blur-effect"?: "light" | "dark" | "extra-light" | "glass" | "glass-container" | null;
	/**
	 * The spacing specifies the distance between elements at which they begin to merge.
	 * @defaultValue 0
	 */
	spacing?: number | null;
	/**
	 * Enables interactive behavior for the glass effect.
	 * @defaultValue false
	 */
	"glass-interactive"?: boolean | null;
	/** The user interface style adopted by `<blur-view>`. */
	"ios-user-interface-style"?: "light" | "dark" | null;
	/**
	 * A tint color applied to the glass effect.
	 * @defaultValue 'transparent'
	 */
	"glass-tint-color"?: string | null;
	/**
	 * The style of the glass effect.
	 * @defaultValue 'regular'
	 */
	"glass-style"?: "regular" | "clear" | null;
}

/** The events `<blur-view>` sends, by name, as its listeners hear them. */
export interface LynxBlurViewEvents
	extends LynxCommonEvents<"blur-view">, LynxDefaultEvents<"blur-view"> {}

/** The attributes and events of `<webview>`. */
export interface LynxWebviewAttributes
	extends LynxCommonAttributes<"webview">, LynxDefaultAttributes<"webview"> {
	/** A string that represents the location of a resource on a remote server. Automatically trigger content refresh when the src changes */
	src?: string | null;
	/** A string that represents the html content to load. Automatically trigger content refresh when the html changes. Priority lower than `src`. */
	html?: string | null;
	/**
	 * Enable bounce effect
	 * @defaultValue false
	 */
	bounces?: boolean | null;
	/**
	 * Enable scrollbar
	 * @defaultValue false
	 */
	"scroll-bar-enable"?: boolean | null;
	/**
	 * Hide the system keyboard accessory view above the software keyboard.
	 * Supported by the built-in loader on iOS 13 and later. Custom loaders must opt in.
	 * @defaultValue false
	 */
	"ios-hide-keyboard-accessory-view"?: boolean | null;
	/** Params for external webview implementation */
	params?: object | null;
	/**
	 * Specify the type of webview, it could be a implementation of a webview inject from LynxService
	 * @defaultValue 'default'
	 */
	"webview-type"?: string | null;
	/**
	 * Enable WebView debugging in Android so that it can be debugged in Chrome DevTools
	 * @defaultValue false
	 */
	"enable-debug"?: boolean | null;
	/** Execute javascript when document ready */
	initjs?: string | null;
	/** Preset cookies */
	cookies?: LynxWebviewCookie[] | null;
	/**
	 * Whether enable offscreen rendering mode
	 * @defaultValue false
	 */
	"use-osr"?: boolean | null;
	/** Load success event */
	onload?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"webview">>>;
	/** `load`, heard in the capture phase: before the elements inside. */
	onloadcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"webview">>>;
	/** `load`, caught here: the elements this is inside do not hear it. */
	oncatchload?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"webview">>>;
	/** `load`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloadcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"webview">>>;
	/** `load`, in a main-thread function. */
	"main-thread:onload"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, in the capture phase. */
	"main-thread:onloadcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught here. */
	"main-thread:oncatchload"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `load`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloadcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Error event */
	onerror?: LynxEventHandler<LynxWebviewErrorEvent<LynxNode, LynxNode<"webview">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxWebviewErrorEvent<LynxNode, LynxNode<"webview">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxWebviewErrorEvent<LynxNode, LynxNode<"webview">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<LynxWebviewErrorEvent<LynxNode, LynxNode<"webview">>>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxWebviewErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<LynxWebviewErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<LynxWebviewErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<
		LynxWebviewErrorEvent<MainThread.Element>
	>;
	/** Message post from javascript */
	onmessage?: LynxEventHandler<LynxWebviewMessageEvent<LynxNode, LynxNode<"webview">>>;
	/** `message`, heard in the capture phase: before the elements inside. */
	onmessagecapture?: LynxEventHandler<LynxWebviewMessageEvent<LynxNode, LynxNode<"webview">>>;
	/** `message`, caught here: the elements this is inside do not hear it. */
	oncatchmessage?: LynxEventHandler<LynxWebviewMessageEvent<LynxNode, LynxNode<"webview">>>;
	/** `message`, caught in the capture phase: the elements inside do not hear it. */
	oncatchmessagecapture?: LynxEventHandler<LynxWebviewMessageEvent<LynxNode, LynxNode<"webview">>>;
	/** `message`, in a main-thread function. */
	"main-thread:onmessage"?: MainThreadEventHandler<LynxWebviewMessageEvent<MainThread.Element>>;
	/** `message`, in a main-thread function, in the capture phase. */
	"main-thread:onmessagecapture"?: MainThreadEventHandler<
		LynxWebviewMessageEvent<MainThread.Element>
	>;
	/** `message`, in a main-thread function, caught here. */
	"main-thread:oncatchmessage"?: MainThreadEventHandler<
		LynxWebviewMessageEvent<MainThread.Element>
	>;
	/** `message`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchmessagecapture"?: MainThreadEventHandler<
		LynxWebviewMessageEvent<MainThread.Element>
	>;
	/** open window event */
	onopenwindow?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `openwindow`, heard in the capture phase: before the elements inside. */
	onopenwindowcapture?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `openwindow`, caught here: the elements this is inside do not hear it. */
	oncatchopenwindow?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `openwindow`, caught in the capture phase: the elements inside do not hear it. */
	oncatchopenwindowcapture?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `openwindow`, in a main-thread function. */
	"main-thread:onopenwindow"?: MainThreadEventHandler<LynxWebviewUrlEvent<MainThread.Element>>;
	/** `openwindow`, in a main-thread function, in the capture phase. */
	"main-thread:onopenwindowcapture"?: MainThreadEventHandler<
		LynxWebviewUrlEvent<MainThread.Element>
	>;
	/** `openwindow`, in a main-thread function, caught here. */
	"main-thread:oncatchopenwindow"?: MainThreadEventHandler<LynxWebviewUrlEvent<MainThread.Element>>;
	/** `openwindow`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchopenwindowcapture"?: MainThreadEventHandler<
		LynxWebviewUrlEvent<MainThread.Element>
	>;
	/** location change event */
	onlocationchange?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `locationchange`, heard in the capture phase: before the elements inside. */
	onlocationchangecapture?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `locationchange`, caught here: the elements this is inside do not hear it. */
	oncatchlocationchange?: LynxEventHandler<LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>>;
	/** `locationchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlocationchangecapture?: LynxEventHandler<
		LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>
	>;
	/** `locationchange`, in a main-thread function. */
	"main-thread:onlocationchange"?: MainThreadEventHandler<LynxWebviewUrlEvent<MainThread.Element>>;
	/** `locationchange`, in a main-thread function, in the capture phase. */
	"main-thread:onlocationchangecapture"?: MainThreadEventHandler<
		LynxWebviewUrlEvent<MainThread.Element>
	>;
	/** `locationchange`, in a main-thread function, caught here. */
	"main-thread:oncatchlocationchange"?: MainThreadEventHandler<
		LynxWebviewUrlEvent<MainThread.Element>
	>;
	/** `locationchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlocationchangecapture"?: MainThreadEventHandler<
		LynxWebviewUrlEvent<MainThread.Element>
	>;
}

/** The events `<webview>` sends, by name, as its listeners hear them. */
export interface LynxWebviewEvents
	extends LynxCommonEvents<"webview">, LynxDefaultEvents<"webview"> {
	/** Load success event */
	load: LynxEvent<LynxNode, LynxNode<"webview">>;
	/** Error event */
	error: LynxWebviewErrorEvent<LynxNode, LynxNode<"webview">>;
	/** Message post from javascript */
	message: LynxWebviewMessageEvent<LynxNode, LynxNode<"webview">>;
	/** open window event */
	openwindow: LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>;
	/** location change event */
	locationchange: LynxWebviewUrlEvent<LynxNode, LynxNode<"webview">>;
}

/** The attributes and events of `<markdown>`. */
export interface LynxMarkdownAttributes
	extends LynxCommonAttributes<"markdown">, LynxDefaultAttributes<"markdown"> {
	/**
	 * Decorations and optional click targets attached to text ranges.
	 * Clay mobile support in 4.3 requires the Skity rendering backend.
	 * @defaultValue []
	 */
	"text-mark-attachments"?: LynxMarkdownTextAttachment[] | null;
	/**
	 * Markdown tags whose visibility should be tracked, such as 'link'.
	 * @defaultValue [] (no exposure tracking)
	 */
	"exposure-tags"?: string[] | null;
	/**
	 * Maximum layout height of the markdown content, in platform logical units.
	 * @defaultValue 0 (no additional height limit)
	 */
	"markdown-max-height"?: number | null;
	/**
	 * Text selection highlight color, encoded as a 32-bit ARGB number.
	 * Clay Android and iOS require the Skity rendering backend in 4.3 prereleases.
	 * Desktop versions refer to the earliest verified prerelease builds.
	 */
	"selection-background-color"?: number | null;
	/**
	 * Text selection handle color, encoded as a 32-bit ARGB number.
	 * Clay Android and iOS require the Skity rendering backend in 4.3 prereleases.
	 * Desktop versions refer to the earliest verified prerelease builds.
	 */
	"selection-handle-color"?: number | null;
	/**
	 * Text selection handle size. Android uses physical pixels; iOS uses points.
	 * Clay Android and iOS require the Skity rendering backend in 4.3 prereleases.
	 * Desktop versions refer to the earliest verified prerelease builds.
	 */
	"selection-handle-size"?: number | null;
	/**
	 * Prefetches the next content height for typewriter height transitions.
	 * Removing this attribute resets it to false on Android and iOS.
	 * @defaultValue true
	 */
	"typewriter-height-transition-prefetch"?: boolean | null;
	/** Markdown source content. */
	content: string;
	/** Set the style of markdown. */
	"markdown-style"?: object | null;
	/**
	 * Which animation to use.
	 * none: no animation.
	 * typewriter: typewriter animation.
	 * line-expand: line expand animation.
	 * @defaultValue 'none'
	 */
	"animation-type"?: "none" | "typewriter" | "line-expand" | null;
	/**
	 * Velocity of animation.
	 * When animation-type is typewriter, it is the number of characters typed per second.
	 * @defaultValue 1
	 */
	"animation-velocity"?: number | null;
	/**
	 * Maximum number of text lines.
	 * A table row is counted as a line.
	 * @defaultValue -1 (no limit)
	 */
	"text-maxline"?: number | null;
	/**
	 * Animation will start at the given step.
	 * @defaultValue 1
	 */
	"initial-animation-step"?: number | null;
	/**
	 * true: typewriter cursor will be hidden and drawEnd event will be triggered after the animation is complete.
	 * false: typewriter cursor will be shown and drawEnd event will not be triggered.
	 * @defaultValue true
	 */
	"content-complete"?: boolean | null;
	/**
	 * Whether markdown height is equal to the content height typed by typewriter.
	 * @defaultValue false
	 */
	"typewriter-dynamic-height"?: boolean | null;
	/**
	 * Whether markdown content is selectable.
	 * @defaultValue false
	 */
	"text-selection"?: boolean | null;
	/**
	 * Alias of text-selection.
	 * @defaultValue false
	 */
	"enable-selection"?: boolean | null;
	/**
	 * Whether text can break around punctuation.
	 * @defaultValue false
	 */
	"allow-break-around-punctuation"?: boolean | null;
	/**
	 * Alias of allow-break-around-punctuation.
	 * @defaultValue false
	 */
	"enable-break-around-punctuation"?: boolean | null;
	/**
	 * The range of content to be parsed.
	 * [start, end]
	 * @defaultValue [0, int32_max]
	 */
	"content-range"?: number[] | null;
	/** Additional effects. */
	"markdown-effect"?: object | null;
	/** Mark the content when the event or UI method is triggered. */
	"content-id"?: string | null;
	/**
	 * Height transition duration. Disable height transition if value less than or equal to 0.
	 * @defaultValue 0
	 */
	"typewriter-height-transition-duration"?: number | null;
	/**
	 * Control animation frame rate to improve performance.
	 * @defaultValue 15
	 */
	"animation-frame-rate"?: number | null;
	/** Draw start. */
	ondrawStart?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawStart`, heard in the capture phase: before the elements inside. */
	ondrawStartcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawStart`, caught here: the elements this is inside do not hear it. */
	oncatchdrawStart?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawStart`, caught in the capture phase: the elements inside do not hear it. */
	oncatchdrawStartcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawStart`, in a main-thread function. */
	"main-thread:ondrawStart"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawStart`, in a main-thread function, in the capture phase. */
	"main-thread:ondrawStartcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawStart`, in a main-thread function, caught here. */
	"main-thread:oncatchdrawStart"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawStart`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchdrawStartcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Draw end. */
	ondrawEnd?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawEnd`, heard in the capture phase: before the elements inside. */
	ondrawEndcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawEnd`, caught here: the elements this is inside do not hear it. */
	oncatchdrawEnd?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawEnd`, caught in the capture phase: the elements inside do not hear it. */
	oncatchdrawEndcapture?: LynxEventHandler<LynxEvent<LynxNode, LynxNode<"markdown">>>;
	/** `drawEnd`, in a main-thread function. */
	"main-thread:ondrawEnd"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawEnd`, in a main-thread function, in the capture phase. */
	"main-thread:ondrawEndcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawEnd`, in a main-thread function, caught here. */
	"main-thread:oncatchdrawEnd"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** `drawEnd`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchdrawEndcapture"?: MainThreadEventHandler<LynxEvent<MainThread.Element>>;
	/** Callback after each animation frame. Some animation steps may be skipped if animation velocity is too fast. */
	onanimationStep?: LynxEventHandler<
		LynxMarkdownAnimationStepEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `animationStep`, heard in the capture phase: before the elements inside. */
	onanimationStepcapture?: LynxEventHandler<
		LynxMarkdownAnimationStepEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `animationStep`, caught here: the elements this is inside do not hear it. */
	oncatchanimationStep?: LynxEventHandler<
		LynxMarkdownAnimationStepEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `animationStep`, caught in the capture phase: the elements inside do not hear it. */
	oncatchanimationStepcapture?: LynxEventHandler<
		LynxMarkdownAnimationStepEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `animationStep`, in a main-thread function. */
	"main-thread:onanimationStep"?: MainThreadEventHandler<
		LynxMarkdownAnimationStepEvent<MainThread.Element>
	>;
	/** `animationStep`, in a main-thread function, in the capture phase. */
	"main-thread:onanimationStepcapture"?: MainThreadEventHandler<
		LynxMarkdownAnimationStepEvent<MainThread.Element>
	>;
	/** `animationStep`, in a main-thread function, caught here. */
	"main-thread:oncatchanimationStep"?: MainThreadEventHandler<
		LynxMarkdownAnimationStepEvent<MainThread.Element>
	>;
	/** `animationStep`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchanimationStepcapture"?: MainThreadEventHandler<
		LynxMarkdownAnimationStepEvent<MainThread.Element>
	>;
	/** Callback when text overflows. */
	onoverflow?: LynxEventHandler<LynxMarkdownOverflowEvent<LynxNode, LynxNode<"markdown">>>;
	/** `overflow`, heard in the capture phase: before the elements inside. */
	onoverflowcapture?: LynxEventHandler<LynxMarkdownOverflowEvent<LynxNode, LynxNode<"markdown">>>;
	/** `overflow`, caught here: the elements this is inside do not hear it. */
	oncatchoverflow?: LynxEventHandler<LynxMarkdownOverflowEvent<LynxNode, LynxNode<"markdown">>>;
	/** `overflow`, caught in the capture phase: the elements inside do not hear it. */
	oncatchoverflowcapture?: LynxEventHandler<
		LynxMarkdownOverflowEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `overflow`, in a main-thread function. */
	"main-thread:onoverflow"?: MainThreadEventHandler<LynxMarkdownOverflowEvent<MainThread.Element>>;
	/** `overflow`, in a main-thread function, in the capture phase. */
	"main-thread:onoverflowcapture"?: MainThreadEventHandler<
		LynxMarkdownOverflowEvent<MainThread.Element>
	>;
	/** `overflow`, in a main-thread function, caught here. */
	"main-thread:oncatchoverflow"?: MainThreadEventHandler<
		LynxMarkdownOverflowEvent<MainThread.Element>
	>;
	/** `overflow`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchoverflowcapture"?: MainThreadEventHandler<
		LynxMarkdownOverflowEvent<MainThread.Element>
	>;
	/** Callback when link is clicked. */
	onlink?: LynxEventHandler<LynxMarkdownLinkEvent<LynxNode, LynxNode<"markdown">>>;
	/** `link`, heard in the capture phase: before the elements inside. */
	onlinkcapture?: LynxEventHandler<LynxMarkdownLinkEvent<LynxNode, LynxNode<"markdown">>>;
	/** `link`, caught here: the elements this is inside do not hear it. */
	oncatchlink?: LynxEventHandler<LynxMarkdownLinkEvent<LynxNode, LynxNode<"markdown">>>;
	/** `link`, caught in the capture phase: the elements inside do not hear it. */
	oncatchlinkcapture?: LynxEventHandler<LynxMarkdownLinkEvent<LynxNode, LynxNode<"markdown">>>;
	/** `link`, in a main-thread function. */
	"main-thread:onlink"?: MainThreadEventHandler<LynxMarkdownLinkEvent<MainThread.Element>>;
	/** `link`, in a main-thread function, in the capture phase. */
	"main-thread:onlinkcapture"?: MainThreadEventHandler<LynxMarkdownLinkEvent<MainThread.Element>>;
	/** `link`, in a main-thread function, caught here. */
	"main-thread:oncatchlink"?: MainThreadEventHandler<LynxMarkdownLinkEvent<MainThread.Element>>;
	/** `link`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchlinkcapture"?: MainThreadEventHandler<
		LynxMarkdownLinkEvent<MainThread.Element>
	>;
	/** Callback when selection changes. */
	onselectionchange?: LynxEventHandler<
		LynxMarkdownSelectionChangeEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `selectionchange`, heard in the capture phase: before the elements inside. */
	onselectionchangecapture?: LynxEventHandler<
		LynxMarkdownSelectionChangeEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `selectionchange`, caught here: the elements this is inside do not hear it. */
	oncatchselectionchange?: LynxEventHandler<
		LynxMarkdownSelectionChangeEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `selectionchange`, caught in the capture phase: the elements inside do not hear it. */
	oncatchselectionchangecapture?: LynxEventHandler<
		LynxMarkdownSelectionChangeEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `selectionchange`, in a main-thread function. */
	"main-thread:onselectionchange"?: MainThreadEventHandler<
		LynxMarkdownSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, in the capture phase. */
	"main-thread:onselectionchangecapture"?: MainThreadEventHandler<
		LynxMarkdownSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught here. */
	"main-thread:oncatchselectionchange"?: MainThreadEventHandler<
		LynxMarkdownSelectionChangeEvent<MainThread.Element>
	>;
	/** `selectionchange`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchselectionchangecapture"?: MainThreadEventHandler<
		LynxMarkdownSelectionChangeEvent<MainThread.Element>
	>;
	/** Callback when image is clicked. */
	onimageTap?: LynxEventHandler<LynxMarkdownImageTapEvent<LynxNode, LynxNode<"markdown">>>;
	/** `imageTap`, heard in the capture phase: before the elements inside. */
	onimageTapcapture?: LynxEventHandler<LynxMarkdownImageTapEvent<LynxNode, LynxNode<"markdown">>>;
	/** `imageTap`, caught here: the elements this is inside do not hear it. */
	oncatchimageTap?: LynxEventHandler<LynxMarkdownImageTapEvent<LynxNode, LynxNode<"markdown">>>;
	/** `imageTap`, caught in the capture phase: the elements inside do not hear it. */
	oncatchimageTapcapture?: LynxEventHandler<
		LynxMarkdownImageTapEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `imageTap`, in a main-thread function. */
	"main-thread:onimageTap"?: MainThreadEventHandler<LynxMarkdownImageTapEvent<MainThread.Element>>;
	/** `imageTap`, in a main-thread function, in the capture phase. */
	"main-thread:onimageTapcapture"?: MainThreadEventHandler<
		LynxMarkdownImageTapEvent<MainThread.Element>
	>;
	/** `imageTap`, in a main-thread function, caught here. */
	"main-thread:oncatchimageTap"?: MainThreadEventHandler<
		LynxMarkdownImageTapEvent<MainThread.Element>
	>;
	/** `imageTap`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchimageTapcapture"?: MainThreadEventHandler<
		LynxMarkdownImageTapEvent<MainThread.Element>
	>;
	/** Callback when a text attachment is clicked. */
	ontextClick?: LynxEventHandler<LynxMarkdownTextClickEvent<LynxNode, LynxNode<"markdown">>>;
	/** `textClick`, heard in the capture phase: before the elements inside. */
	ontextClickcapture?: LynxEventHandler<LynxMarkdownTextClickEvent<LynxNode, LynxNode<"markdown">>>;
	/** `textClick`, caught here: the elements this is inside do not hear it. */
	oncatchtextClick?: LynxEventHandler<LynxMarkdownTextClickEvent<LynxNode, LynxNode<"markdown">>>;
	/** `textClick`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtextClickcapture?: LynxEventHandler<
		LynxMarkdownTextClickEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `textClick`, in a main-thread function. */
	"main-thread:ontextClick"?: MainThreadEventHandler<
		LynxMarkdownTextClickEvent<MainThread.Element>
	>;
	/** `textClick`, in a main-thread function, in the capture phase. */
	"main-thread:ontextClickcapture"?: MainThreadEventHandler<
		LynxMarkdownTextClickEvent<MainThread.Element>
	>;
	/** `textClick`, in a main-thread function, caught here. */
	"main-thread:oncatchtextClick"?: MainThreadEventHandler<
		LynxMarkdownTextClickEvent<MainThread.Element>
	>;
	/** `textClick`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtextClickcapture"?: MainThreadEventHandler<
		LynxMarkdownTextClickEvent<MainThread.Element>
	>;
	/** Callback when parse ends. */
	onparseEnd?: LynxEventHandler<LynxMarkdownParseEndEvent<LynxNode, LynxNode<"markdown">>>;
	/** `parseEnd`, heard in the capture phase: before the elements inside. */
	onparseEndcapture?: LynxEventHandler<LynxMarkdownParseEndEvent<LynxNode, LynxNode<"markdown">>>;
	/** `parseEnd`, caught here: the elements this is inside do not hear it. */
	oncatchparseEnd?: LynxEventHandler<LynxMarkdownParseEndEvent<LynxNode, LynxNode<"markdown">>>;
	/** `parseEnd`, caught in the capture phase: the elements inside do not hear it. */
	oncatchparseEndcapture?: LynxEventHandler<
		LynxMarkdownParseEndEvent<LynxNode, LynxNode<"markdown">>
	>;
	/** `parseEnd`, in a main-thread function. */
	"main-thread:onparseEnd"?: MainThreadEventHandler<LynxMarkdownParseEndEvent<MainThread.Element>>;
	/** `parseEnd`, in a main-thread function, in the capture phase. */
	"main-thread:onparseEndcapture"?: MainThreadEventHandler<
		LynxMarkdownParseEndEvent<MainThread.Element>
	>;
	/** `parseEnd`, in a main-thread function, caught here. */
	"main-thread:oncatchparseEnd"?: MainThreadEventHandler<
		LynxMarkdownParseEndEvent<MainThread.Element>
	>;
	/** `parseEnd`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchparseEndcapture"?: MainThreadEventHandler<
		LynxMarkdownParseEndEvent<MainThread.Element>
	>;
}

/** The events `<markdown>` sends, by name, as its listeners hear them. */
export interface LynxMarkdownEvents
	extends LynxCommonEvents<"markdown">, LynxDefaultEvents<"markdown"> {
	/** Draw start. */
	drawStart: LynxEvent<LynxNode, LynxNode<"markdown">>;
	/** Draw end. */
	drawEnd: LynxEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback after each animation frame. Some animation steps may be skipped if animation velocity is too fast. */
	animationStep: LynxMarkdownAnimationStepEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when text overflows. */
	overflow: LynxMarkdownOverflowEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when link is clicked. */
	link: LynxMarkdownLinkEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when selection changes. */
	selectionchange: LynxMarkdownSelectionChangeEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when image is clicked. */
	imageTap: LynxMarkdownImageTapEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when a text attachment is clicked. */
	textClick: LynxMarkdownTextClickEvent<LynxNode, LynxNode<"markdown">>;
	/** Callback when parse ends. */
	parseEnd: LynxMarkdownParseEndEvent<LynxNode, LynxNode<"markdown">>;
}

/** The attributes and events of `<video>`. */
export interface LynxVideoAttributes
	extends LynxCommonAttributes<"video">, LynxDefaultAttributes<"video"> {
	/** Video source URL. Only online network URLs are supported. */
	src?: string | null;
	/**
	 * Whether to loop playback.
	 * @defaultValue false
	 */
	loop?: boolean | null;
	/**
	 * Playback volume from 0 to 1.
	 * @defaultValue 1.0
	 */
	volume?: number | null;
	/**
	 * Whether the video is muted.
	 * @defaultValue false
	 */
	muted?: boolean | null;
	/**
	 * Playback speed from 0.1 to 2.0.
	 * @defaultValue 1.0
	 */
	speed?: number | null;
	/**
	 * Video scaling strategy.
	 * @defaultValue 'contain'
	 */
	"object-fit"?: "contain" | "cover" | "fill" | null;
	/**
	 * UIMethod execution mode.
	 * @defaultValue 'queue'
	 */
	mode?: "queue" | "direct" | "latest" | null;
	/**
	 * Minimum interval for timeupdate dispatch, in seconds.
	 * @defaultValue 0.33
	 */
	"timeupdate-interval"?: number | null;
	/** Fired when the first video frame has loaded. */
	onfirstframe?: LynxEventHandler<LynxVideoFirstFrameEvent<LynxNode, LynxNode<"video">>>;
	/** `firstframe`, heard in the capture phase: before the elements inside. */
	onfirstframecapture?: LynxEventHandler<LynxVideoFirstFrameEvent<LynxNode, LynxNode<"video">>>;
	/** `firstframe`, caught here: the elements this is inside do not hear it. */
	oncatchfirstframe?: LynxEventHandler<LynxVideoFirstFrameEvent<LynxNode, LynxNode<"video">>>;
	/** `firstframe`, caught in the capture phase: the elements inside do not hear it. */
	oncatchfirstframecapture?: LynxEventHandler<
		LynxVideoFirstFrameEvent<LynxNode, LynxNode<"video">>
	>;
	/** `firstframe`, in a main-thread function. */
	"main-thread:onfirstframe"?: MainThreadEventHandler<LynxVideoFirstFrameEvent<MainThread.Element>>;
	/** `firstframe`, in a main-thread function, in the capture phase. */
	"main-thread:onfirstframecapture"?: MainThreadEventHandler<
		LynxVideoFirstFrameEvent<MainThread.Element>
	>;
	/** `firstframe`, in a main-thread function, caught here. */
	"main-thread:oncatchfirstframe"?: MainThreadEventHandler<
		LynxVideoFirstFrameEvent<MainThread.Element>
	>;
	/** `firstframe`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchfirstframecapture"?: MainThreadEventHandler<
		LynxVideoFirstFrameEvent<MainThread.Element>
	>;
	/** Fired when video playback starts or resumes. */
	onplaying?: LynxEventHandler<LynxVideoPlayingEvent<LynxNode, LynxNode<"video">>>;
	/** `playing`, heard in the capture phase: before the elements inside. */
	onplayingcapture?: LynxEventHandler<LynxVideoPlayingEvent<LynxNode, LynxNode<"video">>>;
	/** `playing`, caught here: the elements this is inside do not hear it. */
	oncatchplaying?: LynxEventHandler<LynxVideoPlayingEvent<LynxNode, LynxNode<"video">>>;
	/** `playing`, caught in the capture phase: the elements inside do not hear it. */
	oncatchplayingcapture?: LynxEventHandler<LynxVideoPlayingEvent<LynxNode, LynxNode<"video">>>;
	/** `playing`, in a main-thread function. */
	"main-thread:onplaying"?: MainThreadEventHandler<LynxVideoPlayingEvent<MainThread.Element>>;
	/** `playing`, in a main-thread function, in the capture phase. */
	"main-thread:onplayingcapture"?: MainThreadEventHandler<
		LynxVideoPlayingEvent<MainThread.Element>
	>;
	/** `playing`, in a main-thread function, caught here. */
	"main-thread:oncatchplaying"?: MainThreadEventHandler<LynxVideoPlayingEvent<MainThread.Element>>;
	/** `playing`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchplayingcapture"?: MainThreadEventHandler<
		LynxVideoPlayingEvent<MainThread.Element>
	>;
	/** Fired when video playback pauses. */
	onpaused?: LynxEventHandler<LynxVideoPausedEvent<LynxNode, LynxNode<"video">>>;
	/** `paused`, heard in the capture phase: before the elements inside. */
	onpausedcapture?: LynxEventHandler<LynxVideoPausedEvent<LynxNode, LynxNode<"video">>>;
	/** `paused`, caught here: the elements this is inside do not hear it. */
	oncatchpaused?: LynxEventHandler<LynxVideoPausedEvent<LynxNode, LynxNode<"video">>>;
	/** `paused`, caught in the capture phase: the elements inside do not hear it. */
	oncatchpausedcapture?: LynxEventHandler<LynxVideoPausedEvent<LynxNode, LynxNode<"video">>>;
	/** `paused`, in a main-thread function. */
	"main-thread:onpaused"?: MainThreadEventHandler<LynxVideoPausedEvent<MainThread.Element>>;
	/** `paused`, in a main-thread function, in the capture phase. */
	"main-thread:onpausedcapture"?: MainThreadEventHandler<LynxVideoPausedEvent<MainThread.Element>>;
	/** `paused`, in a main-thread function, caught here. */
	"main-thread:oncatchpaused"?: MainThreadEventHandler<LynxVideoPausedEvent<MainThread.Element>>;
	/** `paused`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchpausedcapture"?: MainThreadEventHandler<
		LynxVideoPausedEvent<MainThread.Element>
	>;
	/** Fired when video playback is stopped by the stop UIMethod. */
	onstopped?: LynxEventHandler<LynxVideoStoppedEvent<LynxNode, LynxNode<"video">>>;
	/** `stopped`, heard in the capture phase: before the elements inside. */
	onstoppedcapture?: LynxEventHandler<LynxVideoStoppedEvent<LynxNode, LynxNode<"video">>>;
	/** `stopped`, caught here: the elements this is inside do not hear it. */
	oncatchstopped?: LynxEventHandler<LynxVideoStoppedEvent<LynxNode, LynxNode<"video">>>;
	/** `stopped`, caught in the capture phase: the elements inside do not hear it. */
	oncatchstoppedcapture?: LynxEventHandler<LynxVideoStoppedEvent<LynxNode, LynxNode<"video">>>;
	/** `stopped`, in a main-thread function. */
	"main-thread:onstopped"?: MainThreadEventHandler<LynxVideoStoppedEvent<MainThread.Element>>;
	/** `stopped`, in a main-thread function, in the capture phase. */
	"main-thread:onstoppedcapture"?: MainThreadEventHandler<
		LynxVideoStoppedEvent<MainThread.Element>
	>;
	/** `stopped`, in a main-thread function, caught here. */
	"main-thread:oncatchstopped"?: MainThreadEventHandler<LynxVideoStoppedEvent<MainThread.Element>>;
	/** `stopped`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchstoppedcapture"?: MainThreadEventHandler<
		LynxVideoStoppedEvent<MainThread.Element>
	>;
	/** Fired when the playback position updates. */
	ontimeupdate?: LynxEventHandler<LynxVideoTimeUpdateEvent<LynxNode, LynxNode<"video">>>;
	/** `timeupdate`, heard in the capture phase: before the elements inside. */
	ontimeupdatecapture?: LynxEventHandler<LynxVideoTimeUpdateEvent<LynxNode, LynxNode<"video">>>;
	/** `timeupdate`, caught here: the elements this is inside do not hear it. */
	oncatchtimeupdate?: LynxEventHandler<LynxVideoTimeUpdateEvent<LynxNode, LynxNode<"video">>>;
	/** `timeupdate`, caught in the capture phase: the elements inside do not hear it. */
	oncatchtimeupdatecapture?: LynxEventHandler<
		LynxVideoTimeUpdateEvent<LynxNode, LynxNode<"video">>
	>;
	/** `timeupdate`, in a main-thread function. */
	"main-thread:ontimeupdate"?: MainThreadEventHandler<LynxVideoTimeUpdateEvent<MainThread.Element>>;
	/** `timeupdate`, in a main-thread function, in the capture phase. */
	"main-thread:ontimeupdatecapture"?: MainThreadEventHandler<
		LynxVideoTimeUpdateEvent<MainThread.Element>
	>;
	/** `timeupdate`, in a main-thread function, caught here. */
	"main-thread:oncatchtimeupdate"?: MainThreadEventHandler<
		LynxVideoTimeUpdateEvent<MainThread.Element>
	>;
	/** `timeupdate`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchtimeupdatecapture"?: MainThreadEventHandler<
		LynxVideoTimeUpdateEvent<MainThread.Element>
	>;
	/** Fired when video playback fully ends. */
	onended?: LynxEventHandler<LynxVideoEndedEvent<LynxNode, LynxNode<"video">>>;
	/** `ended`, heard in the capture phase: before the elements inside. */
	onendedcapture?: LynxEventHandler<LynxVideoEndedEvent<LynxNode, LynxNode<"video">>>;
	/** `ended`, caught here: the elements this is inside do not hear it. */
	oncatchended?: LynxEventHandler<LynxVideoEndedEvent<LynxNode, LynxNode<"video">>>;
	/** `ended`, caught in the capture phase: the elements inside do not hear it. */
	oncatchendedcapture?: LynxEventHandler<LynxVideoEndedEvent<LynxNode, LynxNode<"video">>>;
	/** `ended`, in a main-thread function. */
	"main-thread:onended"?: MainThreadEventHandler<LynxVideoEndedEvent<MainThread.Element>>;
	/** `ended`, in a main-thread function, in the capture phase. */
	"main-thread:onendedcapture"?: MainThreadEventHandler<LynxVideoEndedEvent<MainThread.Element>>;
	/** `ended`, in a main-thread function, caught here. */
	"main-thread:oncatchended"?: MainThreadEventHandler<LynxVideoEndedEvent<MainThread.Element>>;
	/** `ended`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchendedcapture"?: MainThreadEventHandler<
		LynxVideoEndedEvent<MainThread.Element>
	>;
	/** Fired at the end of each loop iteration. */
	onlooped?: LynxEventHandler<LynxVideoLoopedEvent<LynxNode, LynxNode<"video">>>;
	/** `looped`, heard in the capture phase: before the elements inside. */
	onloopedcapture?: LynxEventHandler<LynxVideoLoopedEvent<LynxNode, LynxNode<"video">>>;
	/** `looped`, caught here: the elements this is inside do not hear it. */
	oncatchlooped?: LynxEventHandler<LynxVideoLoopedEvent<LynxNode, LynxNode<"video">>>;
	/** `looped`, caught in the capture phase: the elements inside do not hear it. */
	oncatchloopedcapture?: LynxEventHandler<LynxVideoLoopedEvent<LynxNode, LynxNode<"video">>>;
	/** `looped`, in a main-thread function. */
	"main-thread:onlooped"?: MainThreadEventHandler<LynxVideoLoopedEvent<MainThread.Element>>;
	/** `looped`, in a main-thread function, in the capture phase. */
	"main-thread:onloopedcapture"?: MainThreadEventHandler<LynxVideoLoopedEvent<MainThread.Element>>;
	/** `looped`, in a main-thread function, caught here. */
	"main-thread:oncatchlooped"?: MainThreadEventHandler<LynxVideoLoopedEvent<MainThread.Element>>;
	/** `looped`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchloopedcapture"?: MainThreadEventHandler<
		LynxVideoLoopedEvent<MainThread.Element>
	>;
	/** Fired when a video playback error occurs. */
	onerror?: LynxEventHandler<LynxVideoErrorEvent<LynxNode, LynxNode<"video">>>;
	/** `error`, heard in the capture phase: before the elements inside. */
	onerrorcapture?: LynxEventHandler<LynxVideoErrorEvent<LynxNode, LynxNode<"video">>>;
	/** `error`, caught here: the elements this is inside do not hear it. */
	oncatcherror?: LynxEventHandler<LynxVideoErrorEvent<LynxNode, LynxNode<"video">>>;
	/** `error`, caught in the capture phase: the elements inside do not hear it. */
	oncatcherrorcapture?: LynxEventHandler<LynxVideoErrorEvent<LynxNode, LynxNode<"video">>>;
	/** `error`, in a main-thread function. */
	"main-thread:onerror"?: MainThreadEventHandler<LynxVideoErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, in the capture phase. */
	"main-thread:onerrorcapture"?: MainThreadEventHandler<LynxVideoErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught here. */
	"main-thread:oncatcherror"?: MainThreadEventHandler<LynxVideoErrorEvent<MainThread.Element>>;
	/** `error`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatcherrorcapture"?: MainThreadEventHandler<
		LynxVideoErrorEvent<MainThread.Element>
	>;
	/** Fired while the video is buffering. */
	onbuffering?: LynxEventHandler<LynxVideoBufferingEvent<LynxNode, LynxNode<"video">>>;
	/** `buffering`, heard in the capture phase: before the elements inside. */
	onbufferingcapture?: LynxEventHandler<LynxVideoBufferingEvent<LynxNode, LynxNode<"video">>>;
	/** `buffering`, caught here: the elements this is inside do not hear it. */
	oncatchbuffering?: LynxEventHandler<LynxVideoBufferingEvent<LynxNode, LynxNode<"video">>>;
	/** `buffering`, caught in the capture phase: the elements inside do not hear it. */
	oncatchbufferingcapture?: LynxEventHandler<LynxVideoBufferingEvent<LynxNode, LynxNode<"video">>>;
	/** `buffering`, in a main-thread function. */
	"main-thread:onbuffering"?: MainThreadEventHandler<LynxVideoBufferingEvent<MainThread.Element>>;
	/** `buffering`, in a main-thread function, in the capture phase. */
	"main-thread:onbufferingcapture"?: MainThreadEventHandler<
		LynxVideoBufferingEvent<MainThread.Element>
	>;
	/** `buffering`, in a main-thread function, caught here. */
	"main-thread:oncatchbuffering"?: MainThreadEventHandler<
		LynxVideoBufferingEvent<MainThread.Element>
	>;
	/** `buffering`, in a main-thread function, caught in the capture phase. */
	"main-thread:oncatchbufferingcapture"?: MainThreadEventHandler<
		LynxVideoBufferingEvent<MainThread.Element>
	>;
}

/** The events `<video>` sends, by name, as its listeners hear them. */
export interface LynxVideoEvents extends LynxCommonEvents<"video">, LynxDefaultEvents<"video"> {
	/** Fired when the first video frame has loaded. */
	firstframe: LynxVideoFirstFrameEvent<LynxNode, LynxNode<"video">>;
	/** Fired when video playback starts or resumes. */
	playing: LynxVideoPlayingEvent<LynxNode, LynxNode<"video">>;
	/** Fired when video playback pauses. */
	paused: LynxVideoPausedEvent<LynxNode, LynxNode<"video">>;
	/** Fired when video playback is stopped by the stop UIMethod. */
	stopped: LynxVideoStoppedEvent<LynxNode, LynxNode<"video">>;
	/** Fired when the playback position updates. */
	timeupdate: LynxVideoTimeUpdateEvent<LynxNode, LynxNode<"video">>;
	/** Fired when video playback fully ends. */
	ended: LynxVideoEndedEvent<LynxNode, LynxNode<"video">>;
	/** Fired at the end of each loop iteration. */
	looped: LynxVideoLoopedEvent<LynxNode, LynxNode<"video">>;
	/** Fired when a video playback error occurs. */
	error: LynxVideoErrorEvent<LynxNode, LynxNode<"video">>;
	/** Fired while the video is buffering. */
	buffering: LynxVideoBufferingEvent<LynxNode, LynxNode<"video">>;
}

/** Every element, by tag: what a component may write on it. */
export interface LynxElements {
	component: LynxComponentAttributes;
	"filter-image": LynxFilterImageAttributes;
	image: LynxImageAttributes;
	"inline-image": LynxInlineImageAttributes;
	"inline-text": LynxInlineTextAttributes;
	"inline-truncation": LynxInlineTruncationAttributes;
	list: LynxListAttributes;
	"list-item": LynxListItemAttributes;
	"list-row": LynxListRowAttributes;
	page: LynxPageAttributes;
	"scroll-view": LynxScrollViewAttributes;
	text: LynxTextAttributes;
	view: LynxViewAttributes;
	"raw-text": LynxRawTextAttributes;
	input: LynxInputAttributes;
	textarea: LynxTextareaAttributes;
	overlay: LynxOverlayAttributes;
	svg: LynxSvgAttributes;
	"title-bar-view": LynxTitleBarViewAttributes;
	refresh: LynxRefreshAttributes;
	"refresh-header": LynxRefreshHeaderAttributes;
	"scroll-coordinator": LynxScrollCoordinatorAttributes;
	"scroll-coordinator-header": LynxScrollCoordinatorHeaderAttributes;
	"scroll-coordinator-slot": LynxScrollCoordinatorSlotAttributes;
	"scroll-coordinator-slot-drag": LynxScrollCoordinatorSlotDragAttributes;
	"scroll-coordinator-toolbar": LynxScrollCoordinatorToolbarAttributes;
	viewpager: LynxViewpagerAttributes;
	"viewpager-item": LynxViewpagerItemAttributes;
	"blur-view": LynxBlurViewAttributes;
	webview: LynxWebviewAttributes;
	markdown: LynxMarkdownAttributes;
	video: LynxVideoAttributes;
}

/** The events of every element, by tag. */
export interface LynxElementEvents {
	component: LynxComponentEvents;
	"filter-image": LynxFilterImageEvents;
	image: LynxImageEvents;
	"inline-image": LynxInlineImageEvents;
	"inline-text": LynxInlineTextEvents;
	"inline-truncation": LynxInlineTruncationEvents;
	list: LynxListEvents;
	"list-item": LynxListItemEvents;
	"list-row": LynxListRowEvents;
	page: LynxPageEvents;
	"scroll-view": LynxScrollViewEvents;
	text: LynxTextEvents;
	view: LynxViewEvents;
	"raw-text": LynxRawTextEvents;
	input: LynxInputEvents;
	textarea: LynxTextareaEvents;
	overlay: LynxOverlayEvents;
	svg: LynxSvgEvents;
	"title-bar-view": LynxTitleBarViewEvents;
	refresh: LynxRefreshEvents;
	"refresh-header": LynxRefreshHeaderEvents;
	"scroll-coordinator": LynxScrollCoordinatorEvents;
	"scroll-coordinator-header": LynxScrollCoordinatorHeaderEvents;
	"scroll-coordinator-slot": LynxScrollCoordinatorSlotEvents;
	"scroll-coordinator-slot-drag": LynxScrollCoordinatorSlotDragEvents;
	"scroll-coordinator-toolbar": LynxScrollCoordinatorToolbarEvents;
	viewpager: LynxViewpagerEvents;
	"viewpager-item": LynxViewpagerItemEvents;
	"blur-view": LynxBlurViewEvents;
	webview: LynxWebviewEvents;
	markdown: LynxMarkdownEvents;
	video: LynxVideoEvents;
}

/** The UI methods every element has, for `invoke`: what each takes and resolves with. */
export interface LynxCommonMethods {
	/** Call this method to get the width, height, and position information of the target element. */
	boundingClientRect: {
		params?: {
			/**
			 * The element to which the coordinates are relative. If not specified, the coordinates are relative to the viewport. If the value is `screen`, the coordinates are relative to the screen. If the value is a element's `id`, the coordinates are relative to the element with the specified ID. Else, the coordinates are relative to the viewport of LynxView.
			 * @defaultValue null
			 */
			relativeTo?: null | string;
			/**
			 * Whether to enable transform props on Android, it is recommended to set it to `true` when the element has transform props.
			 * @defaultValue false
			 */
			androidEnableTransformProps?: boolean;
		};
		result: {
			/** The id of the element */
			id: string;
			/** Dataset of the element. */
			dataset: object;
			/** Left boundary coordinate of the element (in pixels) */
			left: number;
			/** The right boundary coordinates of the element. */
			right: number;
			/** Upper boundary coordinate of the element. */
			top: number;
			/** The lower boundary coordinates of the element. */
			bottom: number;
			/** Width of the element. */
			width: number;
			/** height of the element. */
			height: number;
		};
	};
	/**
	 * Call this method to check if the element is currently animating.
	 * @deprecated Legacy API
	 */
	isAnimating: {
		params?: { [name: string]: never };
		result: {
			data: boolean;
		};
	};
	/** Call this method to request accessibility focus for the element. */
	requestAccessibilityFocus: { params?: { [name: string]: never }; result: unknown };
	/** Call this method to scroll the element into the visible area. */
	scrollIntoView: {
		params: {
			/** Specify the scroll options. */
			scrollIntoViewOptions: {
				/**
				 * Vertical alignment options: "start" aligns top | "center" centers | "end" aligns bottom
				 * @defaultValue 'center'
				 */
				block?: "center" | "start" | "end";
				/**
				 * Horizontal alignment options: "start" aligns left | "center" centers | "end" aligns right
				 * @defaultValue 'start'
				 */
				inline?: "center" | "start" | "end";
				/**
				 * Specify the scroll behavior.
				 * @defaultValue 'smooth'
				 */
				behavior?: "none" | "smooth";
			};
		};
		result: unknown;
	};
	/** Set the element to require focus */
	setFocus: {
		params: {
			/** Set whether the element gains focus, `false` means the element loses focus. */
			focus: boolean;
			/** Whether to scroll the element into the visible area at the same time, default is `true`. */
			scroll?: boolean;
		};
		result: unknown;
	};
	/** Call this method to take a screenshot of the element. */
	takeScreenshot: {
		params: {
			/**
			 * Specify the image format.
			 * @defaultValue 'jpeg'
			 */
			format: "jpeg" | "png";
			/**
			 * Specify the image quality, within [0, 1], the smaller the value, the blurrier and smaller the size.
			 * @defaultValue 1
			 */
			scale?: number;
		};
		result: {
			/** The base64-encoded string of the screenshot image. */
			data: string;
		};
	};
}

/** The UI methods of `<list>`. */
export interface LynxListMethods extends LynxCommonMethods {
	/** Automatic scrolling. */
	autoScroll: {
		params: {
			/**
			 * Start/stop automatic scrolling.
			 * @defaultValue false
			 */
			start?: boolean;
			/** The distance of each second's scrolling, which supports positive and negative values. The unit of distance can be "px", "rpx", "ppx", or null (for iOS, the value must be greater than 1/screen.scale px). */
			rate: string;
			/**
			 * Whether to stop automatically when sliding to the bottom.
			 * @defaultValue true
			 */
			autoStop?: boolean;
		};
		result: unknown;
	};
	/** Get scroll info */
	getScrollInfo: {
		params?: { [name: string]: never };
		result: {
			/** Content offset on X-axis, in PX */
			scrollX: number;
			/** Content offset on Y-axis, in PX */
			scrollY: number;
			/** Content size along orientation, in PX (legacy iOS behavior) */
			scrollRange?: number;
			/** Total scrollable range (max scroll offset) along orientation, in PX */
			maxScrollOffset?: number;
		};
	};
	/** Get the info of the currently displayed list item. */
	getVisibleCells: { params?: { [name: string]: never }; result: unknown };
	/** Scroll the list by the specified offset along its configured orientation. */
	scrollBy: {
		params: {
			/** Offset to scroll, in px. */
			offset: number;
		};
		result: unknown;
	};
	/** Scroll the list to the specified position. */
	scrollToPosition: {
		params: {
			/** Specify the index of the node to scroll to, with a value range of [0, itemCount). */
			index: number;
			/**
			 * Specify the alignment method when scrolling to a target position.
			 * "bottom": Scroll to make the node fully visible in the list and align the bottom of the node with the bottom of the list.
			 * "top": Scroll to make the node fully visible in the list and align the top of the node with the top of the list.
			 * "middle": Scroll to make the node fully visible in the list and align the center of the node with the center of the list. This is only supported in LynxSDK 2.12 and above.
			 * @defaultValue 'top'
			 */
			alignTo?: "top" | "bottom" | "middle";
			/**
			 * Align the node with alignTo, and then move the node downward by a length of offset.
			 * @defaultValue 0
			 */
			offset?: number;
			/** Specify the unique identifier of the node to scroll to. If `item-key` is specified, `index` will be ignored. */
			itemKey?: string;
			/**
			 * Enable scroll animation during scroll.
			 * @defaultValue false
			 */
			smooth?: boolean;
		};
		result: unknown;
	};
}

/** The UI methods of `<scroll-view>`. */
export interface LynxScrollViewMethods extends LynxCommonMethods {
	/** Automatic scrolling */
	autoScroll: {
		params: {
			/** The distance of each second's scrolling, which supports positive and negative values. The unit of distance can be "px", "rpx", "ppx", or null (for iOS, the value must be greater than 1/screen.scale px). */
			rate: number;
			/** Start/stop automatic scrolling. */
			start: boolean;
		};
		result: unknown;
	};
	/** Get scroll info */
	getScrollInfo: {
		params?: { [name: string]: never };
		result: {
			/** Content offset on X-axis, in PX */
			scrollX: number;
			/** Content offset on Y-axis, in PX */
			scrollY: number;
			/** Total scrollable range along orientation, in PX */
			scrollRange: number;
		};
	};
	/** Scroll by specified offset */
	scrollBy: {
		params?: {
			/** Offset to scroll */
			offset?: number;
		};
		result: unknown;
	};
	/** Scroll to specified position */
	scrollTo: {
		params?: {
			/** Offset relative to target node */
			offset?: number;
			/** Enable scroll animation */
			smooth?: boolean;
			/**
			 * Target item index
			 * @defaultValue 0
			 */
			index?: number;
		};
		result: unknown;
	};
	/** Take a screenshot of the full scrollable content. */
	takeContentScreenshot: {
		params?: {
			/**
			 * Specify the image format.
			 * @defaultValue 'jpeg'
			 */
			format?: "jpeg" | "png";
			/**
			 * Specify the output scale.
			 * @defaultValue 1
			 */
			scale?: number;
		};
		result: {
			/** The base64-encoded string of the screenshot image. */
			data: string;
			/** Width of the screenshot image. */
			width: number;
			/** Height of the screenshot image. */
			height: number;
		};
	};
}

/** The UI methods of `<image>`. */
export interface LynxImageMethods extends LynxCommonMethods {
	/** Pauses the animation, without resetting the loop-count. */
	pauseAnimation: { params?: { [name: string]: never }; result: unknown };
	/** Resumes the animation, without resetting the loop-count. */
	resumeAnimation: { params?: { [name: string]: never }; result: unknown };
	/**
	 * Restart the animation playback method controlled by the front end, and the animation playback progress and loop count will be reset.
	 * @deprecated Deprecated. Some scenarios may not call back the call result. It is recommended to use resumeAnimation instead.
	 */
	startAnimate: { params?: { [name: string]: never }; result: unknown };
	/** Stops the animation, and it will reset the loop-count. */
	stopAnimation: { params?: { [name: string]: never }; result: unknown };
}

/** The UI methods of `<input>`. */
export interface LynxInputMethods extends LynxCommonMethods {
	/** Release focus */
	blur: { params?: { [name: string]: never }; result: unknown };
	/** Require focus */
	focus: { params?: { [name: string]: never }; result: unknown };
	/** Get input content */
	getValue: {
		params?: { [name: string]: never };
		result: {
			/** Input content */
			value: string;
			/** Begin position of the selection */
			selectionStart: number;
			/** End position of the selection */
			selectionEnd: number;
			/** Is composing or not, iOS only */
			isComposing: boolean;
		};
	};
	/** Set selection range */
	setSelectionRange: {
		params: {
			/** Start position of the selection */
			selectionStart: number;
			/** End position of the selection */
			selectionEnd: number;
		};
		result: unknown;
	};
	/** Set input content */
	setValue: {
		params: {
			/** Input content */
			value: string;
			/** Optional caret position after replacing the text. */
			cursor?: number;
		};
		result: unknown;
	};
}

/** The UI methods of `<textarea>`. */
export interface LynxTextareaMethods extends LynxCommonMethods {
	/** Release focus */
	blur: { params?: { [name: string]: never }; result: unknown };
	/** Require focus */
	focus: { params?: { [name: string]: never }; result: unknown };
	/** Get input content */
	getValue: {
		params?: { [name: string]: never };
		result: {
			/** Input content */
			value: string;
			/** Begin position of the cursor */
			selectionStart: number;
			/** End position of the cursor */
			selectionEnd: number;
			/** Is composing or not, iOS only */
			isComposing: boolean;
		};
	};
	/** Set selection range */
	setSelectionRange: {
		params: {
			/** Start position of the selection */
			selectionStart: number;
			/** End position of the selection */
			selectionEnd: number;
		};
		result: unknown;
	};
	/** Set input content */
	setValue: {
		params: {
			/** Input content */
			value: string;
			/** Optional caret position after replacing the text. */
			cursor?: number;
		};
		result: unknown;
	};
}

/** The UI methods of `<text>`. */
export interface LynxTextMethods extends LynxCommonMethods {
	/** Gets the selected text. */
	getSelectedText: {
		params?: { [name: string]: never };
		result: {
			selectedText: string;
		};
	};
	/** Gets the bounding rectangle of the text. */
	getTextBoundingRect: {
		params: {
			/** Start index of the text */
			start: number;
			/** End index of the text */
			end: number;
		};
		result: {
			/** Bounding rectangle of the text */
			boundingRect: LynxRect;
			/** Rectangles of the text */
			boxes: LynxRect[];
		};
	};
	/** Sets the text selection. */
	setTextSelection: {
		params: {
			/** X-coordinate of the selection start relative to the element */
			startX: number;
			/** Y-coordinate of the selection start relative to the element */
			startY: number;
			/** X-coordinate of the selection end relative to the element */
			endX: number;
			/** Y-coordinate of the selection end relative to the element */
			endY: number;
			/** Whether to show the start handle, default is true */
			showStartHandle?: boolean;
			/** Whether to show the end handle, default is true */
			showEndHandle?: boolean;
		};
		result: {
			/** Bounding rectangle of the selected text */
			boundingRect: LynxRect;
			/** Rectangles of the selected text */
			boxes: LynxRect[];
			/** Handles of the selected text */
			handles: LynxHandle[];
		};
	};
}

/** The UI methods of `<refresh>`. */
export interface LynxRefreshMethods extends LynxCommonMethods {
	/** When enable-refresh is true, call this method to expose the entire `<refresh-header>`, triggering the startrefresh event, after which `<refresh-header>` will attach to the top edge of the refresh's viewport. */
	autoStartRefresh: { params?: { [name: string]: never }; result: unknown };
	/** Called after the startrefresh event to end the refresh state, making `<refresh-header>` rebound. */
	finishRefresh: { params?: { [name: string]: never }; result: unknown };
}

/** The UI methods of `<scroll-coordinator>`. */
export interface LynxScrollCoordinatorMethods extends LynxCommonMethods {
	setFoldExpanded: {
		params: {
			/** Offset, supports px and rpx */
			offset: string;
			/** Whether folding requires animation */
			smooth: boolean;
		};
		result: unknown;
	};
}

/** The UI methods of `<viewpager>`. */
export interface LynxViewpagerMethods extends LynxCommonMethods {
	/** Slide to the specified page. */
	selectTab: {
		params: {
			/** The index to be scrolled to. */
			index: number;
			/** If a animation effect needed. The default setting is true. */
			smooth: boolean;
		};
		result: unknown;
	};
}

/** The UI methods of `<webview>`. */
export interface LynxWebviewMethods extends LynxCommonMethods {
	/** Write any unwritten cookies data to disk for webview */
	"cookies.flushStore": { params?: { [name: string]: never }; result: unknown };
	/** Get cookies from webview */
	"cookies.get": {
		params?: {
			/** Retrieves cookies which are associated with url. Empty implies retrieving cookies of all URLs */
			url?: string;
			/** Filters cookies by name */
			name?: string;
			/** Retrieves cookies whose path matches path */
			path?: string;
			/** Retrieves cookies whose domains match or are subdomains of domains */
			domain?: string;
			/** Filters cookies by their Secure property */
			secure?: boolean;
			/** Filters cookies by httpOnly */
			httpOnly?: boolean;
			/** Filters out session or persistent cookies */
			session?: boolean;
		};
		result: LynxWebviewCookie[];
	};
	/** Removes the cookies matching url and name */
	"cookies.remove": {
		params: {
			/** The URL associated with the cookie. */
			url: string;
			/** The name of cookie to remove. */
			name?: string;
		};
		result: unknown;
	};
	/** Set a cookie to webview */
	"cookies.set": {
		params: {
			/** The URL to associate the cookie with */
			url: string;
			/** The name of the cookie */
			name: string;
			/** The value of the cookie. Empty by default if omitted */
			value?: string;
			/** The path of the cookie. Empty by default if omitted */
			path?: string;
			/** The domain of the cookie. Empty by default if omitted */
			domain?: string;
			/**
			 * Whether the cookie should be marked as secure
			 * @defaultValue false
			 */
			secure?: boolean;
			/**
			 * Whether the cookie should be marked as HTTP only
			 * @defaultValue false
			 */
			httpOnly?: boolean;
			/**
			 * The Same Site policy to apply to this cookie. Can be unspecified, no_restriction, lax or strict
			 * @defaultValue 'lax'
			 */
			sameSite?: string;
			/** The expiration date of the cookie as the number of seconds since the UNIX epoch */
			expirationDate?: number;
		};
		result: unknown;
	};
	/** Call js function */
	eval: {
		params: {
			/** Name of the function: `javascriptFunc(arg1, arg2)`. */
			func: string;
		};
		result: unknown;
	};
	/** Reload the webview */
	reload: { params?: { [name: string]: never }; result: unknown };
}

/** The UI methods of `<markdown>`. */
export interface LynxMarkdownMethods extends LynxCommonMethods {
	/** Get index of the character at the given position. */
	getCharIndexByPoint: {
		params: {
			/** x-coordinate of the point. */
			x: number;
			/** y-coordinate of the point. */
			y: number;
			/**
			 * Index type of the point.
			 * @defaultValue null, set to source to get index of source content.
			 */
			indexType?: string;
		};
		result: {
			/** Index of the character at the point. */
			index: number;
		};
	};
	/** Get parsed content. */
	getContent: {
		params?: {
			/**
			 * Start index of parsed content.
			 * @defaultValue 0
			 */
			start?: number;
			/**
			 * End index of parsed content.
			 * @defaultValue int32_max
			 */
			end?: number;
		};
		result: {
			/** Parsed content of the given range. */
			content: string;
		};
	};
	/** Get all images in the markdown. */
	getImages: {
		params?: { [name: string]: never };
		result: {
			/** All images in the markdown. */
			images: string[];
		};
	};
	/** Get source ranges of the given tags. */
	getParseResult: {
		params: {
			/** Tags whose source ranges should be returned. */
			tags: string[];
		};
		result: {
			/** Source ranges of the given tags. */
			result: Map<
				string,
				{
					start: number;
					end: number;
				}[]
			>;
		};
	};
	getSelectedText: {
		params?: { [name: string]: never };
		result: {
			/** Selected text. */
			selectedText: string;
		};
	};
	pauseAnimation: {
		params?: { [name: string]: never };
		result: {
			/** Current step of animation. */
			animationStep: number;
		};
	};
	resumeAnimation: {
		params?: {
			/** Animation will start at the given step. */
			animationStep?: number;
		};
		result: unknown;
	};
	/** Control text selection highlighting. */
	setTextSelection: {
		params: {
			/** The x-coordinate of the start of the selected text relative to the text component. */
			startX: number;
			/** The y-coordinate of the start of the selected text relative to the text component. */
			startY: number;
			/** The x-coordinate of the end of the selected text relative to the text component. */
			endX: number;
			/** The y-coordinate of the end of the selected text relative to the text component. */
			endY: number;
		};
		result: {
			/** The bounding box of the selected text. */
			boundingRect: {
				left: number;
				top: number;
				right: number;
				bottom: number;
				width: number;
				height: number;
			};
			/** The bounding boxes of each line. */
			boxes: {
				left: number;
				top: number;
				right: number;
				bottom: number;
				width: number;
				height: number;
			}[];
			/** The cursor positions and the default radius. */
			handles: {
				x: number;
				y: number;
				radius: number;
			}[];
		};
	};
}

/** The UI methods of `<video>`. */
export interface LynxVideoMethods extends LynxCommonMethods {
	/** Pause video playback. */
	pause: { params?: { [name: string]: never }; result: LynxVideoMethodResponse };
	/** Play the video. */
	play: { params?: { [name: string]: never }; result: LynxVideoMethodResponse };
	/** Seek to the target playback position. */
	seek: {
		params: {
			/** Target playback position, in seconds. */
			position: number;
		};
		result: LynxVideoMethodResponse;
	};
	/** Stop video playback. */
	stop: { params?: { [name: string]: never }; result: LynxVideoMethodResponse };
}

/** The UI methods of the elements that have their own, by tag. */
export interface LynxElementMethods {
	list: LynxListMethods;
	"scroll-view": LynxScrollViewMethods;
	image: LynxImageMethods;
	input: LynxInputMethods;
	textarea: LynxTextareaMethods;
	text: LynxTextMethods;
	refresh: LynxRefreshMethods;
	"scroll-coordinator": LynxScrollCoordinatorMethods;
	viewpager: LynxViewpagerMethods;
	webview: LynxWebviewMethods;
	markdown: LynxMarkdownMethods;
	video: LynxVideoMethods;
}

/** The name of every UI method Lynx's types know. */
export type LynxMethodName =
	| "autoScroll"
	| "autoStartRefresh"
	| "blur"
	| "boundingClientRect"
	| "cookies.flushStore"
	| "cookies.get"
	| "cookies.remove"
	| "cookies.set"
	| "eval"
	| "finishRefresh"
	| "focus"
	| "getCharIndexByPoint"
	| "getContent"
	| "getImages"
	| "getParseResult"
	| "getScrollInfo"
	| "getSelectedText"
	| "getTextBoundingRect"
	| "getValue"
	| "getVisibleCells"
	| "isAnimating"
	| "pause"
	| "pauseAnimation"
	| "play"
	| "reload"
	| "requestAccessibilityFocus"
	| "resumeAnimation"
	| "scrollBy"
	| "scrollIntoView"
	| "scrollTo"
	| "scrollToPosition"
	| "seek"
	| "selectTab"
	| "setFocus"
	| "setFoldExpanded"
	| "setSelectionRange"
	| "setTextSelection"
	| "setValue"
	| "startAnimate"
	| "stop"
	| "stopAnimation"
	| "takeContentScreenshot"
	| "takeScreenshot";
