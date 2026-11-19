// The repository's GitHub Actions workflows keep the rules of AGENTS.md § Git and GitHub: no
// `pull_request_target`, read-only permissions unless a job asks for more, only the actions the
// repository allows, each pinned by its commit with the version in a comment, no pull request text
// or input written into a shell command, a time limit on every job, and npm publishing only through
// trusted publishing, without a token. And CI runs every Node.js line a package claims in
// `engines.node`, and the oldest version it claims exactly.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "yaml";

const FOLDER = ".github/workflows";
/** `owner/repo` or `owner/repo/path`, at a full commit SHA. */
const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION_COMMENT = /#\s*v\d/;
const NPM_TOKENS = /\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/;
/**
 * The actions the repository's settings allow (Settings → Actions → General): GitHub's own, and
 * these, each at its commit. GitHub refuses a run that names any other before a job starts.
 */
const ALLOWED = [/^actions\//, /^github\//, "pnpm/setup@731dfb6463bbd11c11fd0ee11fe00ed0e36d48a1"];
/** Text a pull request's author or a caller chooses, which a shell would run as code. */
const UNTRUSTED = /\$\{\{[^}]*\b(?:github\.event\.|github\.head_ref|inputs\.)/;

interface Step {
	uses?: string;
	run?: string;
}

interface Job {
	"timeout-minutes"?: unknown;
	uses?: string;
	strategy?: { matrix?: Record<string, unknown> };
	steps?: Step[];
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
function nodeVersionsOf(job: Job): string[] {
	const matrix = job.strategy?.matrix ?? {};
	const listed = Array.isArray(matrix["node"]) ? matrix["node"] : [];
	const included = Array.isArray(matrix["include"])
		? // Boundary: YAML has no type; an `include` entry is an object of matrix values.
			matrix["include"].map((entry: unknown) => (entry as { node?: unknown } | null)?.node)
		: [];
	return [...listed, ...included].filter((value) => value !== undefined).map(String);
}

/** The major of a version as a matrix writes it: `22`, `22.22.2`, `22.x`. */
const majorOf = (version: string): string => version.split(".")[0]!;

/** The floor of each range of `engines.node` (`^22.22.2 || ^24.15.0` gives 22.22.2 and 24.15.0). */
function floorsOf(range: string): string[] {
	return [...range.matchAll(/(?:^|\|\|)\s*[\^~>=]*\s*(\d+(?:\.\d+){0,2})/g)].map(
		(match) => match[1]!,
	);
}

/** The line of each `uses:` in `text`, with its value, in order. */
function usesLines(text: string): { uses: string; line: string }[] {
	return text
		.split("\n")
		.map((line) => ({ uses: /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line)?.[1], line }))
		.filter((entry): entry is { uses: string; line: string } => entry.uses !== undefined);
}

/** What is wrong with the workflows of the repository in `root`. */
export function checkWorkflows(root: string): string[] {
	const problems: string[] = [];
	const folder = join(root, FOLDER);
	const files = existsSync(folder)
		? readdirSync(folder).filter((name) => /\.ya?ml$/.test(name))
		: [];
	const versionsRun = new Set<string>();

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
		// Every `uses:` as written, its comment included: the parsed YAML drops comments.
		for (const { uses, line } of usesLines(text)) {
			if (uses.startsWith("./")) continue;
			if (!PINNED.test(uses) || !VERSION_COMMENT.test(line)) {
				problems.push(
					`${file}: pin ${uses} by its full commit SHA, with the version in a comment ("owner/action@<sha> # v1.2.3"). A tag can be moved.`,
				);
			} else if (
				!ALLOWED.some((allowed) =>
					typeof allowed === "string" ? uses === allowed : allowed.test(uses),
				)
			) {
				problems.push(
					`${file}: ${uses} is not among the actions this repository allows (actions/*, github/* and pnpm/setup at its pinned commit), so GitHub would refuse the run. Use one of them, or ask the maintainer to allow it in Settings → Actions.`,
				);
			}
		}
		for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
			// A job that calls another workflow takes that workflow's time limits.
			if (job.uses === undefined && typeof job["timeout-minutes"] !== "number") {
				problems.push(`${file}: give job "${id}" a timeout-minutes.`);
			}
			for (const step of job.steps ?? []) {
				if (typeof step.run === "string" && UNTRUSTED.test(step.run)) {
					problems.push(
						`${file}: job "${id}" writes a pull request's text or an input into a shell command, where it can run as code. Pass it through env: and quote the variable.`,
					);
				}
			}
			for (const version of nodeVersionsOf(job)) versionsRun.add(version);
		}
		if (NPM_TOKENS.test(text)) {
			problems.push(
				`${file} uses an npm token. Publish to npm through trusted publishing only, which needs none.`,
			);
		}
	}

	const linesRun = new Set([...versionsRun].map(majorOf));
	for (const parent of ["packages", "modules"]) {
		if (!existsSync(join(root, parent))) continue;
		for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
			const manifestFile = join(root, parent, entry.name, "package.json");
			if (!entry.isDirectory() || !existsSync(manifestFile)) continue;
			// Boundary: JSON has no type; `engines` is optional.
			const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
				engines?: { node?: string };
			};
			const floors = floorsOf(manifest.engines?.node ?? "");
			const where = `${parent}/${entry.name}/package.json`;
			for (const major of floors.map(majorOf)) {
				if (!linesRun.has(major)) {
					problems.push(
						`${where} claims Node.js ${major} in engines.node, which no CI job runs. Add it to a job's node matrix.`,
					);
				}
			}
			const [oldest] = floors;
			if (oldest !== undefined && linesRun.has(majorOf(oldest)) && !versionsRun.has(oldest)) {
				problems.push(
					`${where} claims Node.js ${oldest} and later, which no CI job runs exactly. Add node: ${oldest} to a job's matrix.`,
				);
			}
		}
	}
	return problems;
}
