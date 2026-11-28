// The conformance wrapper keeps the Portal mounted, so the arrow's closed state can be checked;
// the Portal renders after mount only, so the hydration check runs as `clientOnly`.

import { describe } from "vitest";

import { describeConformance } from "../../conformance/conformance-part.js";
import { popoverArrowConformance } from "./fixtures/popover-arrow-conformance.js";

describe("<Popover.Arrow />", () => {
	describeConformance("Popover.Arrow", () => popoverArrowConformance);
});
