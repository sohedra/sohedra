// Change details for core tests: `changeDetails(reason, type, trigger)`, a change for `reason` with
// a stand-in event of `type`.
import {
	createChangeEventDetails,
	type PlatformEvent,
	type PlatformTypes,
	REASONS,
} from "../../src/foundation/kernel/index.js";
import { event } from "./kit-stand-ins.js";

/** The details of a change for `reason`, caused by an event of `type`, from `trigger` if given. */
export function changeDetails<Reason extends string = typeof REASONS.none>(
	reason: Reason = REASONS.none as Reason,
	type = "click",
	trigger?: object,
) {
	return createChangeEventDetails(
		reason,
		event(type) as PlatformEvent<PlatformTypes, Reason>,
		trigger,
	);
}
