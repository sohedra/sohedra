// should_extract_ident_from_this: `this` in a main-thread function.
export function onTap() {
	"main thread";
	const a = 1;
	return [a, this.a];
}
