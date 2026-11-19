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

	it("pass when a job's matrix runs each of them", () => {
		const job = `    timeout-minutes: 10\n    strategy:\n      matrix:\n        include:\n          - node: 22\n          - node: "24"\n    steps:\n      - uses: ${CHECKOUT}\n`;
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([]);
	});

	it("fail when no job runs one of them", () => {
		const job = `    timeout-minutes: 10\n    strategy:\n      matrix:\n        node: [22]\n    steps:\n      - uses: ${CHECKOUT}\n`;
		expect(problemsOf(workflow({ job }), { "packages/x/package.json": manifest })).toEqual([
			"packages/x/package.json claims Node.js 24 in engines.node, which no CI job runs. Add it to a job's node matrix.",
		]);
	});
});

describe("the repository", () => {
	it("passes", () => {
		expect(checkWorkflows(REPO)).toEqual([]);
	});
});
