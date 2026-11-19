// Runs the repository's own lint configs, the root's and this package's, on a few files written to a
// temporary folder at the same paths, so that the package's per-folder rules apply to them.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const PACKAGE = "packages/lynx";
const OXLINT = (() => {
	const manifest = createRequire(path.join(ROOT, "package.json")).resolve("oxlint/package.json");
	// Boundary: the package's manifest, read for its `bin`.
	const { bin } = JSON.parse(fs.readFileSync(manifest, "utf8")) as { bin: Record<string, string> };
	return path.join(path.dirname(manifest), bin["oxlint"]!);
})();

/** One reported problem: the file, and the rule that reported it. */
export interface Problem {
	file: string;
	rule: string;
}

/**
 * Lints `files` (path from the repository root to source text) and returns what was reported.
 * Type-aware rules are off: they need a project, and none of the rules under test uses types.
 */
export function lint(files: Record<string, string>): Problem[] {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lint-"));
	try {
		const text = fs.readFileSync(path.join(ROOT, ".oxlintrc.jsonc"), "utf8");
		const config = ts.parseConfigFileTextToJson(".oxlintrc.jsonc", text).config as {
			options?: Record<string, unknown>;
		};
		config.options = { ...config.options, typeAware: false };
		fs.writeFileSync(path.join(folder, ".oxlintrc.jsonc"), JSON.stringify(config));
		// The package's own config, at its place, so its globs read from the same folder.
		fs.mkdirSync(path.join(folder, PACKAGE), { recursive: true });
		fs.copyFileSync(
			path.join(ROOT, PACKAGE, ".oxlintrc.jsonc"),
			path.join(folder, PACKAGE, ".oxlintrc.jsonc"),
		);
		for (const [file, source] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
			fs.writeFileSync(path.join(folder, file), source);
		}
		// oxlint's own script, run by this Node: `node_modules/.bin/oxlint` is a shell script, which
		// Windows cannot start.
		const result = spawnSync(
			process.execPath,
			[OXLINT, "--format", "json", "--no-error-on-unmatched-pattern", "."],
			{ cwd: folder, encoding: "utf8" },
		);
		const report = JSON.parse(result.stdout) as {
			diagnostics: { code: string; filename: string }[];
		};
		// Windows names the files with `\`.
		return report.diagnostics.map(({ code, filename }) => ({
			file: filename.replaceAll("\\", "/"),
			rule: code,
		}));
	} finally {
		fs.rmSync(folder, { recursive: true, force: true });
	}
}

/** The files among `problems` that a rule reported on. */
export function reported(problems: Problem[], rule: string): Set<string> {
	return new Set(
		problems.filter((problem) => problem.rule === rule).map((problem) => problem.file),
	);
}
