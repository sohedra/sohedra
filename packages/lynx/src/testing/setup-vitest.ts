// Vitest's setup file for `svelteLynx()`: each test ends the page it started, as
// `@testing-library/svelte` cleans up after each test.

import { afterEach } from "vitest";

import { cleanup } from "./cleanup.ts";
import { setTestRunner } from "./globals.ts";

setTestRunner("vitest");
afterEach(cleanup);
