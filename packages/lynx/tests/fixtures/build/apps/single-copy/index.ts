import { outer } from "outer-lib";
import { which } from "thread-lib";

(globalThis as Record<string, unknown>)["page"] = [which, outer];
