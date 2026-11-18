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
 * How long the page waits for the platform's frames, in milliseconds, before it looks again: the
 * system sends no display frames while the app is in the background, and a page that is not on the
 * screen has nothing to paint first.
 */
export const PAINT_TIMEOUT = 500;

/**
 * How long the page waits again, in milliseconds, after a timer. A timer may fire ahead of a frame
 * that waited behind the same work: Android runs every task of the engine's that is due before
 * Choreographer's next frame (base/src/fml/platform/android/message_loop_android.cc, the loop's
 * timer on the thread's `ALooper`), and the first timer comes due while the render's work may
 * still run. A timer armed when another fires is not due yet, so a waiting frame goes first; one
 * that then fires within `LATE` of its time found the thread free, with still no frame.
 */
const LATE = 100;

/** How many times a timer that fires late waits `LATE` again, before the page applies anyway. */
const LATE_WAITS = 10;

/**
 * Runs `painted` once the platform has painted what the engine's render flushed: at the second
 * frame after the render, or, when no frame comes, once a timer after `PAINT_TIMEOUT` has fired
 * on time. The first timer always waits `LATE` again; a later one that fires more than `LATE` late
 * waits again too, at most `LATE_WAITS` times in all. With no frames, as in the background, the
 * page applies after `PAINT_TIMEOUT` and `LATE`. Throws when the thread has no timers or no
 * frames; a timer armed before the throw may still run `painted` later.
 *
 * @workaround first-paint-from-frames kind=lynx-gap delete-when="Lynx tells the main thread when the platform has painted a flush"
 */
export function afterFirstPaint(painted: () => void): void {
	const { lynx } = mainThread;
	let done = false;
	let timer: unknown;
	let waits = 0;
	const once = (): void => {
		if (done) return;
		done = true;
		painted();
		lynx.clearTimeout(timer);
	};
	const arm = (delay: number): void => {
		const due = Date.now() + delay;
		timer = lynx.setTimeout(() => {
			if (done) return;
			if (waits < LATE_WAITS && (waits === 0 || Date.now() - due > LATE)) {
				waits++;
				arm(LATE);
				return;
			}
			once();
		}, delay);
	};
	arm(PAINT_TIMEOUT);
	mainThread.requestAnimationFrame(() => mainThread.requestAnimationFrame(once));
}
