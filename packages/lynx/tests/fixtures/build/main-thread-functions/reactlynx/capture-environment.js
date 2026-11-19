// should_transform_js, should_capture_env, should_not_destructure_from_closure:
// what a body reads from around it is captured; what it declares itself
// (variables, destructured names, parameters, inner functions) is not.
const y1 = [1, 2, 3];
const y2 = 0;
const y3 = "three";
const y4 = "four";
const y5 = { b: 1 };
const y6 = {};
const y7 = "seven";
const y8 = "eight";
const props = { value: { get: () => 1 } };

export function X(event) {
	"main thread";
	console.log(event, y1[y2 + 1]);
	if ({ x: 345 }.x.value) {
		console.log(y3);
	}
	const a = y4;
	const { b, c = y8 } = y5;
	console.log(a, b, c);
	y6.m = y7;
	function xxx() {}
	return xxx;
}

export function Y(n) {
	"main thread";
	const a = 123;
	const b = [a, ...y1];
	// oxlint-disable-next-line unicorn/no-useless-spread -- as in the original: a value captured inside a spread object
	const c = { a, y2, ...y3, ...{ d: 233, e: y4 } };
	console.log(n, b, c);
	return y5.r + props.value.get();
}
