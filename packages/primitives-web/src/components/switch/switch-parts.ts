import SwitchRoot from "./switch-root.svelte";
import SwitchThumb from "./switch-thumb.svelte";
import type {
	SwitchRootChangeEventDetails,
	SwitchRootChangeEventReason,
	SwitchRootProps,
	SwitchRootState,
	SwitchThumbProps,
	SwitchThumbState,
} from "./switch-types.js";

/** Represents the switch itself. Renders a `<span>` element and a hidden `<input>` beside it. */
export const Root = SwitchRoot;
export declare namespace Root {
	export type Props = SwitchRootProps;
	export type State = SwitchRootState;
	export type ChangeEventReason = SwitchRootChangeEventReason;
	export type ChangeEventDetails = SwitchRootChangeEventDetails;
}

/**
 * The movable part of the switch that indicates whether the switch is on or off. Renders a
 * `<span>`.
 */
export const Thumb = SwitchThumb;
export declare namespace Thumb {
	export type Props = SwitchThumbProps;
	export type State = SwitchThumbState;
}
