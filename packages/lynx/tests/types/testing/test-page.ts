// Checked by `pnpm check`, not run. The test library (src/testing, the face of `./testing` once it
// is published): a test page starts with the host's values and each thread's script, and gives
// what each thread sent and reported.

import { cleanup, startTestPage } from "../../../src/testing/index.ts";
import type { Engine, LynxElement, TestPage, TestPageOptions } from "../../../src/testing/index.ts";

const options: TestPageOptions = {
	initData: { route: "/" },
	globalProps: { theme: "dark" },
	systemInfo: { platform: "Android" },
	bundles: {},
	mainThread: () => {},
	background: () => {},
};
const page: TestPage = startTestPage(options);
const engine: Engine = page.engine;
const errors: unknown[] = page.errors;
page.updateData({ count: 1 }, { type: 1 });
const root: LynxElement | undefined = engine.page();
const texts: string[] = engine.texts();
void [errors, root, texts];
cleanup();

// @ts-expect-error the data is an object.
startTestPage({ initData: 3 });
// @ts-expect-error each thread's script is a function.
startTestPage({ background: "app.js" });
// @ts-expect-error what the page reported is read, not replaced.
page.errors = [];
