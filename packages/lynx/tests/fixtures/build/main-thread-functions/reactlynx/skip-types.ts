// should_not_capture_type_annotations: types, and a type and a class declared
// in the body, are not captured.
import type { MainThread } from "@lynx-js/types";

type Size = number;
declare const wv: { current: number };

export function onTap(event: MainThread.TouchEvent) {
	"main thread";
	type Local = Size;
	class N {}
	const a: Local = 0;
	console.log(a, N);
	event.target.setStyleProperty("background-color", wv.current % 2 ? "blue" : "green");
	event.target.setStyleProperty("height", "200px");
}
