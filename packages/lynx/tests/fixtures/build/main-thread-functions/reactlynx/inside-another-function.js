// should_transform_multiple_worklets_in_func: functions made inside another
// function, which capture its locals and parameters.
const y1 = [1, 2, 3];

export function App(z2) {
	const y2 = 0;
	const z1 = [4, 5, 6];
	function X(event) {
		"main thread";
		console.log(event, y1[y2 + 1]);
	}
	function Y(event) {
		"main thread";
		console.log(event, z1[z2 + 1]);
	}
	return { X, Y };
}
