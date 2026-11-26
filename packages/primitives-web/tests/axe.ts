// Automated accessibility checks (axe-core) for browser tests: `expectNoAxeViolations` fails a
// test with every violation axe finds in the rendered DOM, read as a list of rule, element and fix.
import axe from "axe-core";
import { expect } from "vitest";

/**
 * The rules axe runs: WCAG 2.0 and 2.1, levels A and AA, and axe's best practices. WCAG 2.2 and
 * AAA rules are not part of the baseline.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

/**
 * Rules switched off everywhere, each with the reason. Only rules that judge styling the fixtures
 * don't have, or the page the fixture sits in rather than the component, are off; every rule about
 * the semantics a part renders stays on. `avoid-inline-spacing` and `css-orientation-lock` stay on
 * too: they read styles the parts themselves write.
 */
const DISABLED_RULES: Record<string, string> = {
	// Styling: the parts are headless and the fixtures unstyled, so text and background colours are
	// the browser's defaults, not something a part renders.
	"color-contrast": "styling",
	// Styling: whether a link inside text is told apart by more than colour depends on the
	// consumer's stylesheet.
	"link-in-text-block": "styling",
	// Page structure: "all content is inside landmarks" is a rule for the host page. A fixture is not
	// a page, no part renders a landmark of its own, and portals append to `body` by design.
	region: "page structure",
};

/**
 * Findings accepted as intended behaviour. Each is matched by rule and element, so the same rule
 * still fails anywhere else.
 */
const ACCEPTED: readonly {
	rule: string;
	matches: (element: Element, messages: string[]) => boolean;
}[] = [
	{
		// A focus guard is tabbable (it hands focus on as Tab reaches it) and hidden from the
		// accessibility tree (it has nothing to announce).
		rule: "aria-hidden-focus",
		matches: (element) => element.matches(FOCUS_GUARD),
	},
	{
		// On WebKit on Apple platforms (VoiceOver may be running), a focus guard is a `button`
		// instead, so VoiceOver's cursor fires `focus` on it; it has no name.
		rule: "aria-command-name",
		matches: (element) => element.matches(FOCUS_GUARD),
	},
	{
		// The same `button` guards sit inside a menu's popup and, around a portal's placeholder,
		// inside a menubar, where `button` is not an allowed child.
		rule: "aria-required-children",
		matches: (element, messages) =>
			messages.every((message) => message.endsWith("not allowed: [role=button]")) &&
			Array.from(element.querySelectorAll('[role="button"]')).every((child) =>
				child.matches(FOCUS_GUARD),
			),
	},
	{
		// A filterable menu opened without a trigger: its `dialog` popup takes its name from the
		// trigger, so with none rendered there is nothing to name it by (a consumer can pass
		// `aria-label`).
		rule: "aria-dialog-name",
		matches: (element) =>
			element.matches('[role="dialog"][data-rootownerid]:not([aria-labelledby]):not([aria-label])'),
	},
	{
		// A high-priority toast is an `alertdialog` in the tab order that hides itself from the
		// accessibility tree until it holds focus (the viewport's live region announces it instead).
		rule: "aria-hidden-focus",
		matches: (element) =>
			element.matches('[role="alertdialog"][aria-hidden="true"][style*="--toast-index"]'),
	},
];

const FOCUS_GUARD = "[data-sohedra-focus-guard]";

/**
 * Rules whose failures axe reports as "needs review" (`incomplete`) by policy, though the check
 * itself is exact. They fail like violations. Other `incomplete` results stay out: they are the
 * checks axe can't decide (an `aria-controls` target inside a closed popup, a focus guard in a
 * hidden region) and need a person, not a test.
 */
const REVIEW_AS_VIOLATION = new Set([
	// Two elements with an id that an ARIA attribute references: axe 4.x marks it for review since
	// WCAG 2.2 dropped 4.1.1, but which element the reference names is then undefined.
	"duplicate-id-aria",
]);

export type AxeOptions = {
	/** Rules to switch off for one check, each with the reason (a fixture's missing context). */
	disable?: Record<string, string>;
};

/**
 * Runs axe over `container` (default: the whole `body`, so portalled popups are included) and
 * fails with every violation it finds. Hidden elements (`hidden`, `display: none`, inert content
 * outside a modal) are skipped by axe itself, as assistive technology skips them.
 */
export async function expectNoAxeViolations(
	container: Element | Document = document.body,
	options: AxeOptions = {},
): Promise<void> {
	const rules = Object.fromEntries(
		Object.keys({ ...DISABLED_RULES, ...options.disable }).map((id) => [id, { enabled: false }]),
	);
	const results = await axe.run(container, {
		runOnly: { type: "tag", values: TAGS },
		rules,
		resultTypes: ["violations", "incomplete"],
		elementRef: true,
	});
	const reviewed = results.incomplete.filter((result) => REVIEW_AS_VIOLATION.has(result.id));
	const violations = [...results.violations, ...reviewed]
		.map((violation) => ({
			...violation,
			nodes: violation.nodes.filter((node) => !isAccepted(violation.id, node)),
		}))
		.filter((violation) => violation.nodes.length > 0);
	expect(violations.map(formatViolation), "axe violations").toEqual([]);
}

function isAccepted(rule: string, node: axe.NodeResult) {
	const messages = [...node.any, ...node.all, ...node.none].map((check) => check.message);
	return ACCEPTED.some(
		(entry) =>
			entry.rule === rule && node.element !== undefined && entry.matches(node.element, messages),
	);
}

function formatViolation(violation: axe.Result) {
	const nodes = violation.nodes.map(
		(node) => `${node.target.join(" ")}: ${node.html}\n    ${node.failureSummary ?? ""}`,
	);
	return `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help}\n  ${nodes.join("\n  ")}`;
}
