// should_not_transform_when_wrong_directives: none of these is a main-thread
// function.
const y1 = [1, 2, 3];
const y2 = 0;

export function X() {
	"main threads";
	console.log(y1[y2 + 1]);
}

export function Y() {
	console.log(y1[y2 + 1]);
}

export function Z() {
	console.log("main thread");
}

export function A() {
	console.log("");
	// oxlint-disable-next-line no-unused-expressions -- the case: a directive that is not first is only a string
	("main thread");
}
