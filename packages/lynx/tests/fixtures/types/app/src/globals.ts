// What a Lynx thread has without `@sohedra/lynx-polyfill`, as an app's code uses it: the base
// tsconfig and `@sohedra/lynx/client` declare it.

console.log("started", SystemInfo.platform);
const timer: number = setTimeout(() => console.warn("late"), 100);
clearTimeout(timer);
clearInterval(setInterval(() => {}, 1000));
cancelAnimationFrame(requestAnimationFrame((time: number) => console.info(time)));
queueMicrotask(() => console.error("next"));
lynx.reportError(new Error("failed"), { level: "warning" });
lynx.getJSModule("GlobalEventEmitter").addListener("onWindowResize", () => {});
// Lynx's API as Lynx declares it, each member on the thread Lynx gives it.
lynx
	.createIntersectionObserver({}, { thresholds: [0, 1] })
	.relativeToViewport()
	.observe("#card", () => {});
lynx.createSelectorQuery().select("#card").invoke({ method: "scrollIntoView" }).exec();
lynx.performance.profileStart("load");
lynx.performance.profileEnd();
const props: unknown = lynx.__globalProps;
lynx.fetchBundle("https://example.com/a.bundle").then((bundle) => console.log(bundle.code));
const storage: unknown = NativeModules["Storage"];

export { props, storage };
