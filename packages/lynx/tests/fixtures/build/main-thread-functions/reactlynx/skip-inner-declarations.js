// should_extract_idents_outside_of_ctx and should_not_extract_idents_inside_of_ctx:
// a name declared in an inner block or function is that scope's; the same
// name used outside it is the file's, and is captured.
const a = "file a";
const m = "file m";
const b = "file b";
const c = "file c";

export function outside() {
	"main thread";
	if (c) {
		const a = 1;
		console.log(a);
	}
	console.log(a);
	function fn(m, x) {
		const b = 1;
		return [m, x, b];
	}
	return [fn, m, b, c];
}

export function inside() {
	"main thread";
	if (c) {
		const a = 1;
		console.log(a);
	}
	function f(e) {
		return [f, e];
	}
	if (c) {
		// oxlint-disable-next-line no-var -- the case: a `var` in a block belongs to the whole function
		var b = 1;
		console.log(b);
	}
	return [b, f];
}
