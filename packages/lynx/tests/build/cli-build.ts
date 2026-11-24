// Builds an app as an app builds: through rspeedy's or Rsbuild's own CLI, in a process of its own,
// with the binding a dependency in the app's `node_modules`. Takes the build lock, as every build
// test does.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { lock } from "./build-app.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FIXTURES = path.join(ROOT, "tests/fixtures/build");

/** What a CLI build is asked for. */
export interface CliBuildOptions {
	/** The CLI: rspeedy (Lynx's build plugin's) or Rsbuild's. */
	cli: "rspeedy" | "rsbuild";
	/** The app's folder, which has the CLI's config file. */
	cwd: string;
	/** The CLI's arguments after `build`. */
	args?: string[];
}

/** What a CLI build left. */
export interface CliBuild {
	/** Whether the CLI exited with 0. */
	ok: boolean;
	/** What it printed. */
	output: string;
	/** Its output folder: `dist/` of the app. */
	dist: string;
}

/** The path of `cli`'s command: the app's own, or else this package's. */
function commandOf(cli: CliBuildOptions["cli"], cwd: string): string {
	const name = `${cli === "rspeedy" ? "@lynx-js/rspeedy" : "@rsbuild/core"}/package.json`;
	let manifest: string;
	try {
		manifest = createRequire(path.join(cwd, "package.json")).resolve(name);
	} catch {
		manifest = createRequire(import.meta.url).resolve(name);
	}
	// Boundary: the package's manifest, read for its `bin`.
	const { bin } = JSON.parse(fs.readFileSync(manifest, "utf8")) as { bin: Record<string, string> };
	return path.join(path.dirname(manifest), bin[cli]!);
}

/** Run `cli build` in `cwd`, with `DEBUG=lynx`, which keeps each thread's script in `dist/.lynx/<entry>/`. */
export async function cliBuild({ cli, cwd, args = [] }: CliBuildOptions): Promise<CliBuild> {
	const dist = path.join(cwd, "dist");
	fs.rmSync(dist, { recursive: true, force: true });
	const release = await lock();
	try {
		// The test runner's `NODE_ENV` is not the app's: the CLI sets its own from the mode.
		const { NODE_ENV: _runner, ...env } = process.env;
		const run = spawnSync(process.execPath, [commandOf(cli, cwd), "build", ...args], {
			cwd,
			env: { ...env, DEBUG: "lynx" },
			encoding: "utf8",
			timeout: 170_000,
		});
		return { ok: run.status === 0, output: `${run.stdout}\n${run.stderr}`, dist };
	} finally {
		release();
	}
}

/**
 * A copy of fixture `tests/fixtures/build/cli/<app>` outside this package, as an app is: the
 * binding and Svelte linked into its `node_modules`, with the packages of
 * `tests/fixtures/build/packages` it names copied there. Remove it with `fs.rmSync`.
 */
export function cliApp(app: string, packages: string[] = []): string {
	const under = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-cli-"));
	const folder = path.join(under, app);
	fs.cpSync(path.join(FIXTURES, "cli", app), folder, { recursive: true });
	const modules = path.join(folder, "node_modules");
	fs.mkdirSync(path.join(modules, "@sohedra"), { recursive: true });
	// Junctions on Windows, which link a folder without the privilege a symbolic link needs.
	fs.symlinkSync(ROOT, path.join(modules, "@sohedra/lynx"), "junction");
	const svelte = path.dirname(createRequire(import.meta.url).resolve("svelte/package.json"));
	fs.symlinkSync(svelte, path.join(modules, "svelte"), "junction");
	for (const name of packages)
		fs.cpSync(path.join(FIXTURES, "packages", name), path.join(modules, name), {
			recursive: true,
		});
	return folder;
}
