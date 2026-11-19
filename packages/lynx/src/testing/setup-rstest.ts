// Rstest's setup file for `withSvelteLynx()`: each test ends the page it started, as
// `@testing-library/svelte` cleans up after each test.

import { afterEach } from "@rstest/core";

import { cleanup } from "./cleanup.ts";
import { setTestRunner } from "./globals.ts";

setTestRunner("rstest");
afterEach(cleanup);
