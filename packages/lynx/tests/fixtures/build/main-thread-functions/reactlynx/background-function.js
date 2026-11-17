// should_transform_js_fn_in_run_on_js: a function handed to runOnBackground
// is a background function, however it is named.
import { runOnBackground } from "@sohedra/lynx";

const fn1 = () => 1;
const fn3 = "fn3";
const obj = { fn2: () => 2, fn3: () => 3 };

export function onTap() {
	"main thread";
	runOnBackground(fn1)();
	runOnBackground(obj.fn2)();
	runOnBackground(obj[fn3])();
}
