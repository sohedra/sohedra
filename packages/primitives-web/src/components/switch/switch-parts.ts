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

export const Root = SwitchRoot;
export declare namespace Root {
	export type Props = SwitchRootProps;
	export type State = SwitchRootState;
	export type ChangeEventReason = SwitchRootChangeEventReason;
	export type ChangeEventDetails = SwitchRootChangeEventDetails;
}

export const Thumb = SwitchThumb;
export declare namespace Thumb {
	export type Props = SwitchThumbProps;
	export type State = SwitchThumbState;
}
