// What a Lynx thread has without `@sohedra/lynx-polyfill`, as an app's code uses it: the base
// tsconfig and `@sohedra/lynx/client` declare it.

console.log("started", SystemInfo.platform);
const timer: number = setTimeout(() => console.warn("late"), 100);
clearTimeout(timer);
clearInterval(setInterval(() => {}, 1000));
cancelAnimationFrame(requestAnimationFrame((time: number) => console.info(time)));
queueMicrotask(() => console.error("next"));
lynx.reportError(new Error("failed"), { level: "warning" });
const emitter = lynx.getJSModule<{ addListener(name: string, listener: () => void): void }>(
	"GlobalEventEmitter",
);
emitter.addListener("onWindowResize", () => {});
const storage: unknown = NativeModules["Storage"];

export { storage };
