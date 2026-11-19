import { mountPage } from "@sohedra/lynx";

import App from "./App.svelte";

mountPage(App, { props: (data) => ({ title: String(data["title"] ?? "") }) });
