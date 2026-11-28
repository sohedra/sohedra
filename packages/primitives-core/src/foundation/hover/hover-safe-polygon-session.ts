// One hover-out's safe polygon at work: what each pointer move decides, and the close it makes.

import { type PlatformTypes, Timeout } from "../kernel/index.js";
import type { PopupView } from "../popup/index.js";
import { hasOpenChild } from "./hover-rules.js";
import type { SafePolygonInput } from "./hover-safe-polygon-rules.js";
import type { SafePolygon } from "./hover-safe-polygon.js";

/** A pointer move the platform measured, for the safe polygon. */
export type SafePolygonMove = Omit<SafePolygonInput, "hasOpenChild" | "now">;

/** What one hover-out's safe polygon at work is given once. */
export interface SafePolygonSessionDeps<T extends PlatformTypes = PlatformTypes> {
	/** Where the pointer left the trigger, against the popup's side. */
	readonly polygon: SafePolygon;
	/** The popup the pointer travels to: an open child keeps it open. */
	readonly popup: Pick<PopupView<T>, "tree" | "nodeId" | "platform">;
	/** Closes the popup. */
	readonly close: () => void;
}

/**
 * One hover-out's safe polygon at work: each move closes, keeps open, or closes unless another
 * move comes within 40ms.
 */
export class SafePolygonSession<T extends PlatformTypes = PlatformTypes> {
	readonly #polygon: SafePolygon;
	readonly #popup: Pick<PopupView<T>, "tree" | "nodeId" | "platform">;
	readonly #onClose: () => void;
	readonly #closeSoon: Timeout;

	constructor(deps: SafePolygonSessionDeps<T>) {
		this.#polygon = deps.polygon;
		this.#popup = deps.popup;
		this.#onClose = deps.close;
		this.#closeSoon = new Timeout(deps.popup.platform.scheduler);
	}

	/**
	 * A pointer move. `null` is one the platform couldn't measure (the trigger or popup is gone):
	 * it only drops a pending close-soon.
	 */
	move = (input: SafePolygonMove | null): void => {
		this.#closeSoon.clear();
		if (!input) {
			return;
		}
		const decision = this.#polygon.decide({
			...input,
			hasOpenChild: hasOpenChild(this.#popup),
			now: this.#popup.platform.scheduler.now(),
		});
		if (decision === "close") {
			this.#closeIfNoOpenChild();
		} else if (decision === "close-soon") {
			this.#closeSoon.start(40, () => this.#closeIfNoOpenChild());
		}
	};

	#closeIfNoOpenChild() {
		if (!hasOpenChild(this.#popup)) {
			this.#closeSoon.clear();
			this.#onClose();
		}
	}

	/** The tracker went away: drops a pending close-soon. */
	stop = (): void => {
		this.#closeSoon.clear();
	};
}
