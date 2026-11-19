import { mountPage } from "@sohedra/lynx";

import Page from "./Page.svelte";

mountPage(Page, { props: { name: "b" } });
