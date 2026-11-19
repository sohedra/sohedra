import { heavy } from "./star.ts";

(globalThis as Record<string, unknown>)["page"] = heavy;
