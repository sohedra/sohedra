/** The generated id for a part: `$props.id()` with the brand prefix. */
export function sohedraId(uid: string, suffix?: string): string {
	return suffix ? `sohedra-${uid}-${suffix}` : `sohedra-${uid}`;
}
