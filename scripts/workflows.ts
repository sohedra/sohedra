// The repository's GitHub Actions workflows keep the rules of AGENTS.md § Git and GitHub: no
// `pull_request_target`, read-only permissions unless a job asks for more, every action pinned by
// its commit with the version in a comment, a time limit on every job, and npm publishing only
// through trusted publishing, without a token. And every Node.js line a package claims in
// `engines.node` is run by a CI job.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

const FOLDER = ".github/workflows";
/** `owner/repo` or `owner/repo/path`, at a full commit SHA. */
const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION_COMMENT = /#\s*v\d/;
const NPM_TOKENS = /\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/;

interface Job {
	"timeout-minutes"?: unknown;
	uses?: string;
	strategy?: { matrix?: Record<string, unknown> };
	steps?: { uses?: string }[];
}

interface Workflow {
	on?: unknown;
	permissions?: unknown;
	jobs?: Record<string, Job>;
}

/** The events of a workflow's `on`, in any of its forms. */
function eventsOf(on: unknown): string[] {
	if (typeof on === "string") return [on];
	if (Array.isArray(on)) return on.map(String);
	return on !== null && typeof on === "object" ? Object.keys(on) : [];
}

/** Whether `permissions` reads at most the repository's contents. */
function readOnly(permissions: unknown): boolean {
	if (permissions === null || typeof permissions !== "object") return false;
	return Object.entries(permissions).every(
		([scope, level]) => level === "none" || (scope === "contents" && level === "read"),
	);
}

/** The values of `node` in a job's matrix: a list of them, or one in each `include`. */
function nodeLinesOf(job: Job): string[] {
	const matrix = job.strategy?.matrix ?? {};
	const listed = Array.isArray(matrix["node"]) ? matrix["node"] : [];
	const included = Array.isArray(matrix["include"])
		? matrix["include"].map((entry: unknown) => (entry as { node?: unknown } | null)?.node)
		: [];
	return [...listed, ...included].filter((value) => value !== undefined).map(String);
}

/** The Node.js majors of `range` (`^22.22.2 || ^24.15.0` claims 22 and 24). */
function majorsOf(range: string): string[] {
	return [...range.matchAll(/(?:^|\|\|)\s*[\^~>=]*\s*(\d+)/g)].map((match) => match[1]!);
}

/** What is wrong with the workflows of the repository in `root`. */
export function checkWorkflows(root: string): string[] {
	const problems: string[] = [];
	const folder = join(root, FOLDER);
	const files = existsSync(folder)
		? readdirSync(folder).filter((name) => /\.ya?ml$/.test(name))
		: [];
	const nodeLines = new Set<string>();

	for (const name of files) {
		const file = `${FOLDER}/${name}`;
		const text = readFileSync(join(folder, name), "utf8");
		// Boundary: YAML has no type; a workflow has this shape.
		const workflow = (parse(text) ?? {}) as Workflow;

		if (eventsOf(workflow.on).includes("pull_request_target")) {
			problems.push(
				`${file} runs on pull_request_target, which gives a fork's code the repository's secrets and write access. Use pull_request.`,
			);
		}
		if (!readOnly(workflow.permissions)) {
			problems.push(
				`${file} needs "permissions: contents: read" at its top. A job that needs more asks for it itself.`,
			);
		}
		for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
			// A job that calls another workflow takes that workflow's time limits.
			if (job.uses === undefined && typeof job["timeout-minutes"] !== "number") {
				problems.push(`${file}: give job "${id}" a timeout-minutes.`);
			}
			for (const uses of [job.uses, ...(job.steps ?? []).map((step) => step.uses)]) {
				if (uses === undefined || uses.startsWith("./")) continue;
				const line = text.split("\n").find((row) => row.includes(`uses: ${uses}`)) ?? "";
				if (!PINNED.test(uses) || !VERSION_COMMENT.test(line)) {
					problems.push(
						`${file}: pin ${uses} by its full commit SHA, with the version in a comment ("owner/action@<sha> # v1.2.3"). A tag can be moved.`,
					);
				}
			}
			for (const line of nodeLinesOf(job)) nodeLines.add(line);
		}
		if (NPM_TOKENS.test(text)) {
			problems.push(
				`${file} uses an npm token. Publish to npm through trusted publishing only, which needs none.`,
			);
		}
	}

	for (const parent of ["packages", "modules"]) {
		if (!existsSync(join(root, parent))) continue;
		for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
			const manifestFile = join(root, parent, entry.name, "package.json");
			if (!entry.isDirectory() || !existsSync(manifestFile)) continue;
			// Boundary: JSON has no type; `engines` is optional.
			const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
				engines?: { node?: string };
			};
			for (const major of majorsOf(manifest.engines?.node ?? "")) {
				if (!nodeLines.has(major)) {
					problems.push(
						`${parent}/${entry.name}/package.json claims Node.js ${major} in engines.node, which no CI job runs. Add it to a job's node matrix.`,
					);
				}
			}
		}
	}
	return problems;
}
