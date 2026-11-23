// Copies the vendored modules (src/polyfill/vendor/, which bundle.ts writes) into lib/ after
// TypeScript has built it: TypeScript emits only what it compiles, and these are plain JavaScript
// with their declarations beside them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const from = path.join(PACKAGE_ROOT, "src/polyfill/vendor");
const to = path.join(PACKAGE_ROOT, "lib/polyfill/vendor");

fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from))
	fs.copyFileSync(path.join(from, file), path.join(to, file));
