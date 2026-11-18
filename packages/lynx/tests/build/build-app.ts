// Builds a fixture app in this process, through Rsbuild and `pluginSvelteLynx`, and reads what the
// build leaves. One build at a time in a checkout: a lock keeps two test files from building at
// once, and every build test goes through here.
//
// The parts of the runtime not in this package yet (the window's size) are aliased to the stubs in
// tests/fixtures/build/stubs: they let the build resolve; nothing runs.

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { createRsbuild } from "@rsbuild/core";
import type { Rspack, RsbuildConfig } from "@rsbuild/core";

import { pluginSvelteLynx } from "../../src/build/plugin/index.ts";
import type { PluginSvelteLynxOptions } from "../../src/build/plugin/index.ts";
import { PACKAGE_NAME } from "../../src/wire/index.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/build");

/** What a build is asked for. */
export interface BuildAppOptions {
	/** The options of `pluginSvelteLynx`. */
	plugin?: PluginSvelteLynxOptions;
	/** Rsbuild's config, merged over the test's own. */
	rsbuild?: RsbuildConfig;
	/** The entry file in the app's folder. */
	entry?: string;
	/** A development build. */
	development?: boolean;
	/**
	 * Build a copy of the app outside this package's folder, with only Svelte linked in: an app that
	 * has no dependency of its own on `@sohedra/lynx`, which no folder above it brings either.
	 */
	outside?: boolean;
	/** Packages of `tests/fixtures/build/packages` put into the app's `node_modules`. Implies `outside`. */
	packages?: string[];
	/** Who runs the build: `rstest` makes it a test run, without the Lynx engine. */
	callerName?: string;
	/** Files written into the app's copy, by path: for the ones no formatter may read (a component that does not compile). Implies `outside`. */
	files?: Record<string, string>;
}

/** What a build left. */
export interface AppBuild {
	/** Whether it built. */
	ok: boolean;
	/** The error's text when it did not. */
	error: string;
	/** The build's warnings and errors, as the bundler printed them. */
	messages: string;
	/** The output folder. */
	dist: string;
}

const STUBS = path.join(FIXTURES, "stubs");
const ALIASES: Record<string, string> = {
	[`${PACKAGE_NAME}/internal/window-size`]: path.join(STUBS, "window-size.ts"),
};

// The lock lives in this package's own cache folder: one checkout's test files take turns, and
// nothing goes in the shared temporary folder, where another user could make or link the path first.
const LOCK_FOLDER = path.resolve(import.meta.dirname, "../../node_modules/.cache");
fs.mkdirSync(LOCK_FOLDER, { recursive: true });
const LOCK = path.join(LOCK_FOLDER, "build-tests.lock");

/** Whether process `pid` is running. */
function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// Another user's process is running; only "no such process" says it is gone.
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/**
 * Waits for this checkout's one build slot, and returns how to give it back. The lock is a file
 * made in one step (`wx`: it fails when it exists), so two processes never both take it. A lock
 * whose holder is gone is renamed away first, and only one process wins that rename. A lock with
 * no pid yet is its holder between creating it and writing it: held.
 */
export async function lock(): Promise<() => void> {
	for (;;) {
		try {
			fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
			return () => fs.rmSync(LOCK, { force: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
		const pid = Number.parseInt(readPid(), 10);
		if (Number.isInteger(pid) && !isRunning(pid)) {
			const away = `${LOCK}.${process.pid}.${Date.now()}`;
			try {
				fs.renameSync(LOCK, away);
				fs.rmSync(away, { force: true });
			} catch {
				// Another process took it over first.
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
}

function readPid(): string {
	try {
		return fs.readFileSync(LOCK, "utf8");
	} catch {
		return "";
	}
}

/** The folder of fixture app `app`. */
export const appFolder = (app: string): string => path.join(FIXTURES, "apps", app);

/** A copy of the fixture app in `under`, with Svelte's package linked into its `node_modules`. */
function copyOutside(app: string, under: string, options: BuildAppOptions): string {
	const folder = path.join(under, "app");
	fs.cpSync(appFolder(app), folder, { recursive: true });
	const modules = path.join(folder, "node_modules");
	fs.mkdirSync(modules);
	const svelte = path.dirname(createRequire(import.meta.url).resolve("svelte/package.json"));
	fs.symlinkSync(svelte, path.join(modules, "svelte"), "dir");
	for (const name of options.packages ?? []) {
		const target = path.join(modules, name);
		fs.cpSync(path.join(FIXTURES, "packages", name), target, { recursive: true });
		// A `node_modules` folder is not kept in git: a package's own is written `_node_modules`.
		const nested = path.join(target, "_node_modules");
		if (fs.existsSync(nested)) fs.renameSync(nested, path.join(target, "node_modules"));
	}
	for (const [name, text] of Object.entries(options.files ?? {}))
		fs.writeFileSync(path.join(folder, name), text);
	return folder;
}

/** Build fixture app `app` into a folder of its own, and say how it went. */
export async function buildApp(app: string, options: BuildAppOptions = {}): Promise<AppBuild> {
	const release = await lock();
	const dist = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-dist-"));
	const cwd =
		options.outside || options.files || options.packages
			? copyOutside(app, dist, options)
			: appFolder(app);
	// `DEBUG=lynx` keeps each thread's script in `.lynx/<entry>/`, where the tests read them; and
	// `process.env.DEBUG` in the fixtures is replaced by it.
	const previous = process.env["DEBUG"];
	process.env["DEBUG"] = "lynx";
	try {
		const rsbuild = await createRsbuild({
			cwd,
			...(options.callerName !== undefined && { callerName: options.callerName }),
			config: {
				mode: options.development ? "development" : "production",
				plugins: [pluginSvelteLynx(options.plugin)],
				...options.rsbuild,
				source: {
					entry: { main: options.entry ?? "./index.ts" },
					...options.rsbuild?.source,
				},
				resolve: { alias: ALIASES, ...options.rsbuild?.resolve },
				output: {
					distPath: { root: path.join(dist, "out") },
					cleanDistPath: false,
					...options.rsbuild?.output,
				},
			},
		});
		// Run the compiler itself: a failed `rsbuild.build()` throws a short error, and the stats
		// hold what the bundler printed.
		const compiler = await rsbuild.createCompiler();
		const stats = await new Promise<Rspack.Stats | Rspack.MultiStats | undefined>(
			(resolve, reject) => {
				compiler.run((error, result) => (error ? reject(error) : resolve(result)));
			},
		);
		await new Promise<void>((resolve) => compiler.close(() => resolve()));
		const messages = stats?.toString({ all: false, errors: true, warnings: true }) ?? "";
		return { ok: stats?.hasErrors() === false, error: "", messages, dist };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
			messages: "",
			dist,
		};
	} finally {
		if (previous === undefined) delete process.env["DEBUG"];
		else process.env["DEBUG"] = previous;
		release();
	}
}

/** Remove a build's output. */
export function cleanBuild(build: AppBuild): void {
	fs.rmSync(build.dist, { recursive: true, force: true });
}

/** The scripts of a build's entry, as the engine kept them. */
export function scriptsOf(
	build: AppBuild,
	entry = "main",
): { mainThread: string; background: string } {
	const folder = path.join(build.dist, "out", ".lynx", entry);
	const files = fs.readdirSync(folder);
	const background = files.find((name) => name.startsWith("background") && name.endsWith(".js"));
	return {
		mainThread: fs.readFileSync(path.join(folder, "main-thread.js"), "utf8"),
		background: fs.readFileSync(path.join(folder, background ?? "background.js"), "utf8"),
	};
}

/** The template the engine encoded, parsed. */
// oxlint-disable-next-line typescript/no-explicit-any -- the encoded template is read by key, as the engine writes it
export function readTemplate(build: AppBuild, entry = "main"): Record<string, any> {
	return JSON.parse(
		fs.readFileSync(path.join(build.dist, "out", ".lynx", entry, "tasm.json"), "utf8"),
	);
}
