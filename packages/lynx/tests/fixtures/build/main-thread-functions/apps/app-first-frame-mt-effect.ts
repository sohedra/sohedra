// A main-thread function only an $effect uses.
export function effectOnMain(value: number) {
	"main thread";
	(globalThis as Record<string, unknown>).mtEffect = `${value} mt-effect-main-thread-marker`;
}
