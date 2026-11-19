// The builds the build tests share: one production build and one development build of the fixture
// apps, an entry each, in place of a build per test file. The first test file to ask for one builds
// it, while it holds the build lock; the others read what it left. A run's builds live in the
// folder its global setup makes (global-setup.ts), and go with it.
//
// A shared build's messages are the whole build's: a warning from any fixture fails each test that
// checks its own entry builds without one, under that test's name. Sizes are not measured here
// (size-budgets.test.ts builds its own entries): a module that several entries use stays a module
// of its own, where one entry's build would concatenate it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { appFolder, buildInto, lock } from "./build-app.ts";
import type { AppBuild, BuildAppOptions } from "./build-app.ts";
import { SHARED_BUILDS } from "./global-setup.ts";

/** Which shared build. */
export type SharedMode = "production" | "development";

/** The entries of each shared build. */
interface Entries {
	production:
		| "first-frame"
		| "lazy"
		| "lazy-page"
		| "snapshot"
		| "snapshot-action"
		| "device"
		| "syntax";
	development: "snapshot" | "device";
}

/** An entry of a shared build. */
export type SharedEntry<Mode extends SharedMode> = Entries[Mode];

/** The entries of each shared build, by name: files of `tests/fixtures/build/apps/`. */
const ENTRIES: { [Mode in SharedMode]: Record<Entries[Mode], string> } = {
	production: {
		"first-frame": "./first-frame/index.ts",
		lazy: "./lazy/index.ts",
		"lazy-page": "./lazy/page.ts",
		snapshot: "./snapshot/index.ts",
		"snapshot-action": "./snapshot/action.ts",
		device: "./device/index.ts",
		syntax: "./syntax/index.ts",
	},
	development: {
		snapshot: "./snapshot/index.ts",
		device: "./device/index.ts",
	},
};

const OPTIONS: Record<SharedMode, Omit<BuildAppOptions, "entry">> = {
	production: {},
	development: {
		development: true,
		// A device runs a development build from the dev server, whose client needs the host's
		// native modules: these builds leave it out.
		rsbuild: { dev: { hmr: false, liveReload: false } },
	},
};

/** The run's folder of shared builds: the global setup's, or one for this process, gone at its exit. */
function runFolder(): string {
	let folder = process.env[SHARED_BUILDS];
	if (folder === undefined) {
		const own = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-builds-"));
		process.once("exit", () => fs.rmSync(own, { recursive: true, force: true }));
		folder = process.env[SHARED_BUILDS] = own;
	}
	return folder;
}

const builds = new Map<SharedMode, Promise<Omit<AppBuild, "entry">>>();

/** The build recorded at `record` by an earlier test file of the run, or `undefined` if none is. */
function readRecord(record: string): Omit<AppBuild, "entry"> | undefined {
	try {
		return JSON.parse(fs.readFileSync(record, "utf8")) as Omit<AppBuild, "entry">;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

async function buildOnce(mode: SharedMode): Promise<Omit<AppBuild, "entry">> {
	const dist = path.join(runFolder(), mode);
	const record = path.join(dist, "build.json");
	const release = await lock();
	try {
		const recorded = readRecord(record);
		if (recorded) return recorded;
		// A build that stopped before its record leaves no output for this one to build over.
		fs.rmSync(dist, { recursive: true, force: true });
		fs.mkdirSync(dist, { recursive: true });
		const build = await buildInto({
			cwd: appFolder("."),
			dist,
			entries: ENTRIES[mode],
			options: OPTIONS[mode],
		});
		fs.writeFileSync(record, JSON.stringify(build));
		return build;
	} finally {
		release();
	}
}

/**
 * Entry `entry` of the shared build `mode`, built once for the whole run. Its messages are the
 * whole build's. Nothing to clean: the run's folder goes at its end.
 */
export async function sharedBuild<Mode extends SharedMode>(
	mode: Mode,
	entry: SharedEntry<Mode>,
): Promise<AppBuild> {
	let build = builds.get(mode);
	if (build === undefined) builds.set(mode, (build = buildOnce(mode)));
	return { ...(await build), entry };
}
