export const width = (): number => document.body.clientWidth;

(globalThis as Record<string, unknown>)["page"] = width;
