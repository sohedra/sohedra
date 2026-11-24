// `pnpm -F @sohedra/lynx-polyfill generate`: writes the types of what each import fills
// (generate.ts).

import fs from "node:fs";
import path from "node:path";

import { generateTypes } from "./generate.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

for (const file of await generateTypes()) {
	fs.mkdirSync(path.dirname(path.join(ROOT, file.path)), { recursive: true });
	fs.writeFileSync(path.join(ROOT, file.path), file.text);
}
