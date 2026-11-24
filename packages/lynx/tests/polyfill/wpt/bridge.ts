// WPT's testharness.js in a thread's realm: what the harness needs that a thread of Lynx lacks, and
// the line from the harness to the driver (driver.ts). Runs in PrimJS, after the thread's fills.

import type { Thread } from "../../../src/wire/index.ts";
import { describe, report, whenIdle } from "../realm.ts";

/** A subtest's result, as testharness.js hands it to `add_result_callback`. */
interface HarnessTest {
	name: string;
	status: number;
	message: string | null;
}

/** The harness's own status, as testharness.js hands it to `add_completion_callback`. */
interface HarnessStatus {
	status: number;
	message: string | null;
}

declare function read(path: string): string;

/** What testharness.js puts on the global object that the bridge uses. */
interface Harness {
	add_result_callback(callback: (test: HarnessTest) => void): void;
	add_completion_callback(callback: (tests: unknown, status: HarnessStatus) => void): void;
	timeout(): void;
}

/** The names of testharness.js's statuses of a subtest, by number (`Test.statuses`). */
const TEST_STATUSES = ["PASS", "FAIL", "TIMEOUT", "NOTRUN", "PRECONDITION_FAILED"];

/** The names of its statuses of the harness, by number (`TestsStatus.statuses`). */
const HARNESS_STATUSES = ["OK", "ERROR", "TIMEOUT", "PRECONDITION_FAILED"];

/** Prepares the realm for testharness.js, and gives the driver's script `wptDriver`. */
export function connectWpt(thread: Thread): void {
	// Boundary: the realm's global object.
	const scope = globalThis as unknown as Record<string, unknown> & Harness;
	// testharness.js runs on `self`, and its shell environment asks `GLOBAL` what the realm is, as
	// Node.js's runner gives it (test/common/wpt/worker.js). The `self` fill, where it runs, is
	// already in place.
	scope["self"] ??= globalThis;
	scope["GLOBAL"] = {
		isWindow: () => false,
		isWorker: () => false,
		isShadowRealm: () => false,
	};
	let completed = false;
	let timedOut = false;
	const driver = {
		thread,
		/**
		 * Hands the harness's results to the driver: called once testharness.js has loaded, with
		 * the WPT checkout's root and the test file's folder.
		 */
		connect(root: string, folder: string): void {
			// testharness.js reads a test's JSON resources with `fetch_json`, which a host without
			// `fetch` replaces, as WPT's ShadowRealm runner does: here, from the checkout.
			scope["fetch_json"] = (resource: string): Promise<unknown> =>
				Promise.resolve().then(() =>
					JSON.parse(read(resource.startsWith("/") ? root + resource : `${folder}/${resource}`)),
				);
			scope.add_result_callback((test) => {
				report({
					type: "result",
					name: test.name,
					status: TEST_STATUSES[test.status] ?? String(test.status),
					message: test.message,
				});
			});
			scope.add_completion_callback((_tests, status) => {
				completed = true;
				report({
					type: "completion",
					status: HARNESS_STATUSES[status.status] ?? String(status.status),
					message: status.message,
				});
			});
			// A shell has no harness timeout: when nothing is left that could finish a test, the
			// unfinished ones time out.
			whenIdle(() => {
				if (completed || timedOut) return false;
				timedOut = true;
				scope.timeout();
				return true;
			});
		},
		/** Tells the driver a test file's script threw as it ran. */
		scriptError(file: string, error: unknown): void {
			report({ type: "script-error", file, message: describe(error) });
		},
	};
	Object.defineProperty(scope, "wptDriver", { value: driver, configurable: true, writable: true });
}
