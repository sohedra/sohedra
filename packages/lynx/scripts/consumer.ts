// The package as an app gets it: packed as it is published, installed into a fresh app
// (tests/fixtures/consumer) with one package manager, then the app's production build and its tests
// under both test presets. CI runs it for each package manager the package supports, on each Node.js
// line it supports, and once at the floor of every range.
//
//   node scripts/consumer.ts --manager <pnpm|npm|yarn|bun> [--versions newest|floor]
//                            [--tarball <file>] [--keep]
//
// `--versions newest` (the default) installs what each range resolves to today. `--versions floor`
// installs each peer, and each dependency of the package, at the lowest version its range allows
// (pnpm only). `--tarball` installs a package packed before (`pnpm pack`), where this script would
// build and pack it itself: CI packs with the repository's Node.js and runs the app on another.
//
// The app is made in a new folder of the system's temporary folder, outside this repository so that
// nothing resolves from its `node_modules`, and removed after a pass unless `--keep` is given.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_FIXTURE = path.join(ROOT, "tests/fixtures/consumer");
/** Yarn, run from npm's registry: its `node-modules` linker, as the package supports. */
const YARN = "4.18.1";

interface Manager {
	/** The command and its first arguments. */
	command: string[];
	/** The arguments of an install with no lockfile. */
	install: string[];
	/** Files the manager reads in the app, by name. */
	files?: Record<string, string>;
}

const MANAGERS: Record<string, Manager> = {
	pnpm: { command: ["pnpm"], install: ["install", "--no-frozen-lockfile"] },
	npm: { command: ["npm"], install: ["install", "--no-audit", "--no-fund"] },
	yarn: {
		command: ["npm", "exec", "--yes", `--package=@yarnpkg/cli-dist@${YARN}`, "--", "yarn"],
		install: ["install"],
		files: {
			// Plug'n'Play is not supported: the app gets a `node_modules` folder. CI forbids a new
			// lockfile unless told otherwise, and this app has none.
			".yarnrc.yml":
				"nodeLinker: node-modules\nenableImmutableInstalls: false\nenableTelemetry: false\n",
		},
	},
	bun: { command: ["bun"], install: ["install"] },
};

interface Manifest {
	name: string;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	peerDependencies: Record<string, string>;
}

/** The lowest version `range` allows, for the ranges the package writes: `^1.2.3` or `1.2.3`. */
function floorOf(name: string, range: string): string {
	const floor = /^\^?(\d+\.\d+\.\d+)$/.exec(range)?.[1];
	if (floor === undefined)
		throw new Error(
			`${name}'s range ${range} has no floor to install. Write it as ^x.y.z, from the version tested.`,
		);
	return floor;
}

/** Run `command` in `cwd`, showing its output; throws when it fails. */
function run(command: string[], cwd: string): void {
	console.log(`\n> ${command.join(" ")}   (in ${cwd})`);
	const [file, ...args] = command;
	// Windows starts package managers through their `.cmd` shims, which need a shell.
	execFileSync(file!, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

/** Build the package and pack it into `folder`, as it is published; returns the tarball. */
function pack(folder: string): string {
	fs.rmSync(path.join(ROOT, "lib"), { recursive: true, force: true });
	run(["pnpm", "run", "build"], ROOT);
	run(["pnpm", "pack", "--pack-destination", folder], ROOT);
	const tarball = fs.readdirSync(folder).find((name) => name.endsWith(".tgz"));
	if (tarball === undefined) throw new Error(`pnpm pack wrote no tarball in ${folder}.`);
	return path.join(folder, tarball);
}

/** The app's manifest: the fixture's, with the packed package, Svelte, and every peer the app needs. */
function appManifest(options: { tarball: string; floor: boolean }): Record<string, unknown> {
	const own = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;
	const fixture = JSON.parse(
		fs.readFileSync(path.join(APP_FIXTURE, "package.json"), "utf8"),
	) as Record<string, unknown>;
	const peers = Object.entries(own.peerDependencies).filter(([name]) => name !== "svelte");
	return {
		...fixture,
		dependencies: {
			[own.name]: `file:${options.tarball}`,
			// The custom-renderer build is not on npm's registry yet: an app installs it by its URL.
			svelte: own.devDependencies["svelte"],
		},
		devDependencies: {
			// What the app has besides the package's peers: TypeScript, for its config files.
			...(fixture["devDependencies"] as Record<string, string>),
			...Object.fromEntries(
				peers.map(([name, range]) => [name, options.floor ? floorOf(name, range) : range]),
			),
		},
	};
}

/** pnpm's settings that hold each dependency of the package at its floor. */
function floorOverrides(): string {
	const own = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;
	const overrides = Object.fromEntries(
		Object.entries(own.dependencies).map(([name, range]) => [
			`${own.name}>${name}`,
			floorOf(name, range),
		]),
	);
	// JSON is YAML too.
	return `${JSON.stringify({ overrides }, null, "\t")}\n`;
}

function main(): void {
	const { values } = parseArgs({
		options: {
			manager: { type: "string" },
			versions: { type: "string", default: "newest" },
			tarball: { type: "string" },
			keep: { type: "boolean", default: false },
		},
	});
	const manager = MANAGERS[values.manager ?? ""];
	if (manager === undefined)
		throw new Error(`Name the package manager: --manager ${Object.keys(MANAGERS).join("|")}.`);
	if (values.versions !== "newest" && values.versions !== "floor")
		throw new Error(`--versions is newest or floor, not ${values.versions}.`);
	const floor = values.versions === "floor";
	if (floor && values.manager !== "pnpm")
		throw new Error("--versions floor runs with pnpm, whose overrides hold the floors.");

	const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-consumer-"));
	const app = path.join(work, "app");
	const tarball = values.tarball === undefined ? pack(work) : path.resolve(values.tarball);
	fs.cpSync(APP_FIXTURE, app, { recursive: true });
	fs.writeFileSync(
		path.join(app, "package.json"),
		`${JSON.stringify(appManifest({ tarball, floor }), null, "\t")}\n`,
	);
	for (const [name, text] of Object.entries(manager.files ?? {}))
		fs.writeFileSync(path.join(app, name), text);
	if (floor) fs.writeFileSync(path.join(app, "pnpm-workspace.yaml"), floorOverrides());

	run([...manager.command, ...manager.install], app);
	run([...manager.command, "run", "build"], app);
	const bundle = path.join(app, "dist/main.lynx.bundle");
	if (!fs.existsSync(bundle)) throw new Error(`The build wrote no ${bundle}.`);
	run([...manager.command, "run", "test:rstest"], app);
	run([...manager.command, "run", "test:vitest"], app);

	if (values.keep) console.log(`\nThe app is kept in ${app}.`);
	else fs.rmSync(work, { recursive: true, force: true });
	console.log(`\nThe packed package builds and tests with ${values.manager} (${values.versions}).`);
}

main();
