// Makes the labels on GitHub match `.github/labels.yml`: creates missing labels, updates changed
// ones and deletes labels the file doesn't list. Prints the plan; changes nothing without --apply.
//
//   pnpm labels:sync                 show what would change in sohedra/sohedra
//   pnpm labels:sync --apply         change it
//   pnpm labels:sync --repo o/r      another repository

import { execFileSync } from "node:child_process";

import { readLabels, type Label } from "./labels.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const repoIndex = args.indexOf("--repo");
const repo = repoIndex === -1 ? "sohedra/sohedra" : args[repoIndex + 1];
if (!repo) {
	throw new Error("--repo needs a value such as sohedra/sohedra.");
}

function gh(...ghArgs: string[]): string {
	return execFileSync("gh", ghArgs, { encoding: "utf8" });
}

const wanted = readLabels();
const current = JSON.parse(
	gh("api", "--paginate", "--slurp", `repos/${repo}/labels?per_page=100`),
) as Label[][];
const existing = new Map(current.flat().map((label) => [label.name, label]));

const steps: { action: string; run: () => void }[] = [];
for (const label of wanted) {
	const old = existing.get(label.name);
	const fields = ["-f", `color=${label.color}`, "-f", `description=${label.description}`];
	if (!old) {
		steps.push({
			action: `create  ${label.name}`,
			run: () =>
				gh("api", "-X", "POST", `repos/${repo}/labels`, "-f", `name=${label.name}`, ...fields),
		});
	} else if (
		old.color.toLowerCase() !== label.color.toLowerCase() ||
		old.description !== label.description
	) {
		steps.push({
			action: `update  ${label.name}`,
			run: () =>
				gh(
					"api",
					"-X",
					"PATCH",
					`repos/${repo}/labels/${encodeURIComponent(label.name)}`,
					...fields,
				),
		});
	}
	existing.delete(label.name);
}
for (const name of existing.keys()) {
	steps.push({
		action: `delete  ${name}`,
		run: () => gh("api", "-X", "DELETE", `repos/${repo}/labels/${encodeURIComponent(name)}`),
	});
}

if (steps.length === 0) {
	console.log(`${repo}: labels already match .github/labels.yml.`);
} else {
	for (const step of steps) {
		console.log(step.action);
		if (apply) {
			step.run();
		}
	}
	console.log(
		apply
			? `${repo}: ${steps.length} change(s) applied.`
			: `${repo}: ${steps.length} change(s) planned. Run again with --apply to make them.`,
	);
}
