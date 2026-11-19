import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "@rstest/core";

import { checkWorkflows } from "../../../../../scripts/workflows.ts";

const REPO = path.resolve(import.meta.dirname, "../../../../..");
const CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";
const folders: string[] = [];

afterEach(() => {
	for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

/** A repository with these files, by path. */
function repository(files: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-workflows-"));
	folders.push(root);
	for (const [file, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), text);
	}
	return root;
}

/** A workflow with one job, `job` written under it, and `on` and `permissions` as given. */
function workflow(options: { on?: string; permissions?: string; job?: string } = {}): string {
	const {
		on = "on:\n  pull_request:\n",
		permissions = "permissions:\n  contents: read\n",
		job = `    timeout-minutes: 10\n    steps:\n      - uses: ${CHECKOUT}\n`,
	} = options;
	return `name: CI\n${on}${permissions}jobs:\n  checks:\n    runs-on: ubuntu-latest\n${job}`;
}

/** The problems of a repository whose only file is workflow `text`. */
const problemsOf = (text: string, more: Record<string, string> = {}): string[] =>
	checkWorkflows(repository({ ".github/workflows/ci.yml": text, ...more }));

describe("a workflow", () => {
	it("passes with read-only permissions, actions pinned by commit, and a time limit", () => {
		expect(problemsOf(workflow())).toEqual([]);
	});

	it("never runs on pull_request_target, in any form of `on`", () => {
		for (const on of [
			"on: pull_request_target\n",
			"on: [push, pull_request_target]\n",
			"on:\n  pull_request_target:\n    types: [opened]\n",
		]) {
			const [problem, ...rest] = problemsOf(workflow({ on }));
			expect(rest).toEqual([]);
			expect(problem).toContain(".github/workflows/ci.yml");
			expect(problem).toContain("pull_request_target");
		}
	});

	it("sets read-only permissions at its top", () => {
		for (const permissions of [
			"",
			"permissions: write-all\n",
			"permissions:\n  contents: write\n",
		]) {
			const [problem, ...rest] = problemsOf(workflow({ permissions }));
			expect(rest).toEqual([]);
			expect(problem).toContain("permissions");
		}
	});

	it("pins each action by its commit, with the version in a comment", () => {
		for (const uses of [
			"actions/checkout@v7",
			"actions/checkout@v7.0.1 # v7.0.1",
			"actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
			"docker://node:26",
		]) {
			const job = `    timeout-minutes: 10\n    steps:\n      - uses: ${uses}\n`;
			const [problem, ...rest] = problemsOf(workflow({ job }));
			expect(rest).toEqual([]);
			expect(problem).toContain(uses.split(" ")[0]!);
		}
	});

	it("may use an action of this repository by its path", () => {
		const job = `    timeout-minutes: 10\n    steps:\n      - uses: ./.github/actions/setup\n`;
		expect(problemsOf(workflow({ job }))).toEqual([]);
	});

	it("pins each use of an action, not only its first", () => {
		const job = `    timeout-minutes: 10\n    steps:\n      - uses: ${CHECKOUT}\n      - uses: ${CHECKOUT.split(" ")[0]}\n`;
		const [problem, ...rest] = problemsOf(workflow({ job }));
		expect(rest).toEqual([]);
		expect(problem).toContain("actions/checkout@");
	});

	it("uses only the actions the repository allows: GitHub's own, and pnpm/setup at its pinned commit", () => {
		const allowed = `pnpm/setup@731dfb6463bbd11c11fd0ee11fe00ed0e36d48a1 # v3.2.0`;
		const job = (uses: string) => `    timeout-minutes: 10\n    steps:\n      - uses: ${uses}\n`;
		expect(problemsOf(workflow({ job: job(allowed) }))).toEqual([]);
		for (const uses of [
			"pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1",
			"oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0",
			"pnpm/setup@0123456789012345678901234567890123456789 # v3.3.0",
		]) {
			const [problem, ...rest] = problemsOf(workflow({ job: job(uses) }));
			expect(rest).toEqual([]);
			expect(problem).toContain(uses.split(" ")[0]!);
			expect(problem).toContain("not among the actions this repository allows");
		}
	});

	it("never writes a pull request's text or an input into a shell command", () => {
		for (const value of [
			"github.event.pull_request.title",
			"github.head_ref",
			"inputs.name",
			" github.event.issue.body ",
		]) {
			const job = `    timeout-minutes: 10\n    steps:\n      - run: echo "\${{${value}}}"\n`;
			const [problem, ...rest] = problemsOf(workflow({ job }));
			expect(rest).toEqual([]);
			expect(problem).toContain("env:");
		}
	});

	it("may pass a pull request's text to a shell command through env", () => {
		const job = `    timeout-minutes: 10\n    steps:\n      - run: echo "$TITLE"\n        env:\n          TITLE: \${{ github.event.pull_request.title }}\n`;
		expect(problemsOf(workflow({ job }))).toEqual([]);
	});

	it("gives every job a time limit", () => {
		const job = `    steps:\n      - uses: ${CHECKOUT}\n`;
		const [problem, ...rest] = problemsOf(workflow({ job }));
		expect(rest).toEqual([]);
		expect(problem).toContain("checks");
		expect(problem).toContain("timeout-minutes");
	});

	it("publishes to npm through trusted publishing only, never with a token", () => {
		const job = `    timeout-minutes: 10\n    steps:\n      - run: npm publish\n        env:\n          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}\n`;
		const [problem, ...rest] = problemsOf(workflow({ job }));
		expect(rest).toEqual([]);
		expect(problem).toContain("trusted publishing");
	});
});

describe("the Node.js lines a package claims", () => {
	const manifest = JSON.stringify({
		name: "@sohedra/x",
		engines: { node: "^22.22.2 || ^24.15.0" },
	});
	/** A job whose matrix runs `nodes`, written as the YAML of a list item each. */
	const runs = (...nodes: string[]) =>
		`    timeout-minutes: 10\n    strategy:\n      matrix:\n        include:\n${nodes.map((node) => `          - node: ${node}\n`).join("")}    steps:\n      - uses: ${CHECKOUT}\n`;

	it("pass when a job's matrix runs each line, and the oldest version claimed", () => {
		const job = runs("22", '"24"', "22.22.2");
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([]);
	});

	it("count a version of a line as that line", () => {
		const job = runs("22.22.2", "24.x");
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([]);
	});

	it("fail when no job runs one of them", () => {
		const job = runs("22.22.2");
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([
			"packages/x/package.json claims Node.js 24 in engines.node, which no CI job runs. Add it to a job's node matrix.",
		]);
	});

	it("fail when no job runs the oldest version claimed", () => {
		const job = runs("22", "24");
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([
			"packages/x/package.json claims Node.js 22.22.2 and later, which no CI job runs exactly. Add node: 22.22.2 to a job's matrix.",
		]);
	});
});

describe("the repository", () => {
	it("passes", () => {
		expect(checkWorkflows(REPO)).toEqual([]);
	});
});
