// Stands for a large dependency: only the background script may carry it.
(globalThis as Record<string, unknown>)["heavyMarker"] = "heavy-marker";
export function heavy(name: string): string {
	return name;
}
