// should_transform_multiple_worklets
const y1 = [1, 2, 3];
const y2 = 0;
const z1 = [4, 5, 6];
const z2 = 1;

export function X(event) {
	"main thread";
	console.log(event, y1[y2 + 1]);
}

export function Y(event) {
	"main thread";
	console.log(event, z1[z2 + 1]);
}
