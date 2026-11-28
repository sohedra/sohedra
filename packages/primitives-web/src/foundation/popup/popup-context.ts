// The contexts every popup shares on the web. Core never reads a context. The popup tree is
// created by the outermost popup Root and joined by every Root nested in it; the node context
// holds the id of the nearest popup node, which nested popups hang under. The dialog context
// is Dialog's, set by Dialog.Root, AlertDialog.Root and Drawer.Root: every popup Root reads it
// to learn whether it is nested in a popup (`isNestedInPopup`).

import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type { PopupTree } from "@sohedra/primitives-core/foundation/popup/index.js";

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

/** The dialog a part is rendered in: Dialog.Root sets its store. */
export const DialogRootContext = defineContext<PopupDialogView>("Dialog.Root");
