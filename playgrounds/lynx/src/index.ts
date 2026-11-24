// The web's standard APIs and the language through ES2025, first, before any module that uses them.
import "@sohedra/lynx-polyfill";
import { mountPage } from "@sohedra/lynx";

import App from "./App.svelte";

mountPage(App);
