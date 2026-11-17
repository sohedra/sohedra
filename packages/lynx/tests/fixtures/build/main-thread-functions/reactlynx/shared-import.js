// should_skip_shared_identifiers: an import marked as shared with the main
// thread is not captured.
import { sharedRuntime } from "./utils.js" with { runtime: "shared" };

const local = 1;

export function worklet() {
	"main thread";
	return [sharedRuntime, local];
}
