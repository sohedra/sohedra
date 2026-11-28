// The contexts every popup shares on the web. Core never reads a context. The popup tree is
// created by the outermost popup Root and joined by every Root nested in it; the node context
// holds the id of the nearest popup node, which nested popups hang under. Every popup Root reads
// the dialog context to learn whether it is nested in a popup (`isNestedInPopup`).

import { defineContext } from "@sohedra/primitives-core/foundation/kernel";
import type { PopupTree } from "@sohedra/primitives-core/foundation/popup";

import type { WebTypes } from "../kernel/index.js";

/** The tree nested popups share; the outermost popup Root creates it. */
export const PopupTreeContext = defineContext<PopupTree<WebTypes>>("Root");

/** The id of the nearest enclosing popup node (a Positioner), for its nested popups. */
export const PopupNodeContext = defineContext<string>("Positioner");

/**
 * What a popup Root reads of the dialog it is rendered in: the dialog's node in the popup tree,
 * and whether the dialog itself is nested in a popup.
 */
export interface PopupDialogView {
	readonly nodeId: string | undefined;
	readonly nested: boolean;
}

/** The dialog a part is rendered in; unset outside a dialog. */
export const DialogRootContext = defineContext<PopupDialogView>("Dialog.Root");
