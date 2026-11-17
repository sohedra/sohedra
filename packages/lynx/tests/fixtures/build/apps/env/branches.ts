import { svelteConfig } from "@sohedra/lynx/config/svelte";
import { dev } from "@sohedra/lynx/env";
import { BROWSER, DEV } from "esm-env";

import { onBackground, onMainThread } from "./thread.ts";

const marks: string[] = [];

if (onMainThread) marks.push("main-thread-branch");
else marks.push("not-main-thread-branch");

if (onBackground) marks.push("background-branch");
else marks.push("not-background-branch");

marks.push(BROWSER ? "browser-branch" : "no-browser-branch");
marks.push(DEV ? "esm-dev-branch" : "esm-prod-branch");
marks.push(dev ? "env-dev-branch" : "env-prod-branch");

// Some code of the binding itself in the bundle, for the source maps.
marks.push(String(svelteConfig().preprocess.length));

export { marks };
