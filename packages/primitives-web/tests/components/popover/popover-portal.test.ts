// The Portal resolves its container after mount, so the hydration check runs as `clientOnly`.

import { describe } from "vitest";

import { describeConformance } from "../../conformance/describe-conformance.js";
import { popoverPortalConformance } from "./fixtures/popover-portal-conformance.js";

describe("<Popover.Portal />", () => {
	describeConformance("Popover.Portal", () => popoverPortalConformance);
});
