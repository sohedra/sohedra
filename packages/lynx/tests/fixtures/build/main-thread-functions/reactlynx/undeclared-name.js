// should_not_capture_globals, its last line: a name that no declaration in
// the file and no list of engine globals knows.
export function Y() {
	"main thread";
	return myCustomGlobal;
}
