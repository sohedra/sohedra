// should_not_extract_catch_clause_params: `e` and `f` are the catch clauses'
// own; the `g` after them is the file's.
const g = 1;

export function onTap() {
	"main thread";
	try {
		console.log("try");
	} catch (e) {
		console.log(e);
	}
	try {
		console.log("try");
	} catch ({ f, g }) {
		console.log(f, g);
	}
	return g;
}
