import BadComponent from "./BadComponent.svelte";

(globalThis as Record<string, unknown>)["page"] = BadComponent;
