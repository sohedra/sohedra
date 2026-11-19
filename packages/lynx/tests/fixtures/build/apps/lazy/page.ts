// The lazy page as a page that starts, for the run on threads shaped like a device's. Its
// module-level `import()` runs before the page starts.
import { mountPage } from "@sohedra/lynx";

import LazyHost from "./LazyHost.svelte";

const early = import("./Early.svelte").then((module) => module.default);

mountPage(LazyHost, { props: { early } });
