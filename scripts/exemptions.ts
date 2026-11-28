// Exemptions from a repository check: each says why its case is right, or starts with "todo:" for a
// known violation still to fix. An exemption that no longer matches a problem fails, so the list
// only shrinks.

/** A problem a check found, under the key an exemption names. */
export interface Finding {
	key: string;
	message: string;
}

/** The messages of `findings` that no exemption covers, and one for each exemption left unused. */
export function unexempted(
	findings: Finding[],
	exemptions: Record<string, string>,
	where: string,
): string[] {
	const used = new Set<string>();
	const problems: string[] = [];
	for (const { key, message } of findings) {
		if (key in exemptions) {
			used.add(key);
		} else {
			problems.push(message);
		}
	}
	for (const [key, reason] of Object.entries(exemptions)) {
		if (reason.trim() === "") {
			problems.push(`${where}: give the exemption for ${key} a reason, or "todo: <what to fix>".`);
		} else if (!used.has(key)) {
			problems.push(`${where}: ${key} has nothing to exempt any more. Remove its exemption.`);
		}
	}
	return problems;
}
