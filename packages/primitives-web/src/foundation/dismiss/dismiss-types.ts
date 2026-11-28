import type { Props } from "../kernel/index.js";

export interface DismissPopup {
	/** Spread on the popup's element. It holds an attachment. */
	readonly props: Props;
}

export interface DismissTrigger {
	/** Spread on the trigger's element. */
	readonly props: Props;
}
