// When the platform has painted the first frame. The main thread applies a patch on the thread that
// lays out and draws (the UI thread, by default on both platforms), so a patch that comes
// before the first paint delays it by what it costs. Lynx tells the main thread nothing when the
// platform paints: `lynx.performance.addTimingListener` does nothing there
// (core/runtime/lepus/bindings/renderer_functions.cc, AddTimingListener).
//
// Both platforms draw at a frame, and the main thread's `requestAnimationFrame` asks for one
// (core/runtime/lepus/bindings/renderer_functions.cc, RequestAnimationFrame):
// - Android posts a Choreographer frame callback (platform/android/lynx_android/src/main/java/com/
//   lynx/tasm/core/VSyncMonitor.java, requestOnUIThread). Choreographer runs those before the
//   frame's traversal, which measures, lays out and draws the page; the paint mark is taken as the
//   page's root view draws (behavior/ui/UIBody.java, dispatchDraw, markPaintEndTimingIfNeeded).
//   So the first frame callback after the render comes before its paint, and the second after it.
// - iOS runs a display link on the main run loop (core/base/darwin/vsync_monitor_darwin.mm), and
//   marks the paint in a block it queues on the main queue once the UI operations are flushed
//   (core/renderer/ui_wrapper/painting/ios/painting_context_darwin.mm, SetNeedMarkPaintEndTiming).

import { mainThread } from "./globals.ts";

/**
 * How long the page waits for the platform's frames, in milliseconds, before it takes the first
 * frame as painted: the system sends no display frames while the app is in the background, and a
 * page that is not on the screen has nothing to paint first.
 */
export const PAINT_TIMEOUT = 500;

/**
 * Runs `painted` once the platform has painted what the engine's render flushed: at the second
 * frame after the render, or after `PAINT_TIMEOUT` if no frame comes, whichever is first.
 *
 * @workaround first-paint-from-frames kind=lynx-gap delete-when="Lynx tells the main thread when the platform has painted a flush"
 */
export function afterFirstPaint(painted: () => void): void {
	const { lynx } = mainThread;
	let done = false;
	const once = (): void => {
		if (done) return;
		done = true;
		lynx.clearTimeout(timer);
		painted();
	};
	const timer = lynx.setTimeout(once, PAINT_TIMEOUT);
	mainThread.requestAnimationFrame(() => mainThread.requestAnimationFrame(once));
}
