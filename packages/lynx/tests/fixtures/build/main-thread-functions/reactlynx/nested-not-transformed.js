// should_not_transform_recursively: a main-thread function inside another is
// part of the outer one's body.
const y1 = [1, 2, 3];
const y2 = 0;
const z1 = [4, 5, 6];
const z2 = 1;

export function X() {
	"main thread";
	console.log(y1[y2 + 1]);
	function Y() {
		"main thread";
		console.log(y1[y2 + 1]);
		console.log(z1[z2 + 1]);
	}
	return Y;
}
