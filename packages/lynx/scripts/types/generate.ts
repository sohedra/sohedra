// Writes the types generated from `@lynx-js/types`: `pnpm -F @sohedra/lynx generate`. Run it after
// moving to a new `@lynx-js/types`, and review the diff.

import fs from "node:fs";
import path from "node:path";

import { generateTypes } from "./index.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

for (const file of await generateTypes()) {
	const target = path.join(ROOT, file.path);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, file.text);
	console.log(`wrote ${file.path}`);
}
