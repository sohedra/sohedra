import { startPage } from "@sohedra/lynx/internal/page";

import App from "./App.svelte";

startPage(App, { props: (data) => ({ title: String(data["title"] ?? "") }) });
