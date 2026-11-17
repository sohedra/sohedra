// Stands in, in the build tests, for the module compiled main-thread functions import. The tests
// build; nothing runs it.

export function loadWorkletRuntime(): boolean {
	return true;
}
