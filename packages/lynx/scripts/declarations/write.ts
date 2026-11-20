// Writes the declarations an app gets: `pnpm -F @sohedra/lynx declarations`. Run it after changing
// what a public entry exports, and review the diff.

import fs from "node:fs";
import path from "node:path";

import { bundleDeclarations } from "./index.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

for (const file of await bundleDeclarations()) {
	const target = path.join(ROOT, file.path);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, file.text);
	console.log(`wrote ${file.path}`);
}
