import "@sohedra/lynx-polyfill/encoding";
import Encode from "./Encode.svelte";

(globalThis as Record<string, unknown>)["page"] = Encode;
