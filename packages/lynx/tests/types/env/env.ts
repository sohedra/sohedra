// Checked by `pnpm check`, not run. `@sohedra/lynx/environment`: which thread the code runs on, and
// whether the build is a development one, as constants.

import * as env from "@sohedra/lynx/environment";

const flags: boolean[] = [env.background, env.dev, env.mainThread];
void flags;

// @ts-expect-error there is no other flag: Svelte's are `esm-env`'s.
void env.browser;
