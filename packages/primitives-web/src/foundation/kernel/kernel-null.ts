// The kernel's null objects: what a part reads where no provider set a context.
import { DirectionStore } from "./kernel-direction.js";

/** The text direction outside any provider. */
export const LTR = new DirectionStore(() => "ltr");
