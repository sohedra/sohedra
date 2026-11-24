// ES2018 to ES2022 syntax that PrimJS refuses (`??=`, `||=`, `&&=`, static blocks, `#x in`, `\p{…}`
// without Unicode tables) or gets wrong (`??` on Lynx 4.2), each in a check that is true when the
// build lowers it right.
let unset = null;
unset ??= 1;
let falsy = 0;
falsy ||= 2;
let truthy = 1;
truthy &&= 3;

class Branded {
	// oxlint-disable-next-line no-unused-private-class-members -- read by `#brand in`, the syntax under test
	#brand = 1;
	static ready = false;
	static {
		Branded.ready = true;
	}
	static has(value) {
		return #brand in value;
	}
}

const orFive = (value) => value ?? 5;
const nested = { inner: { value: 6 } };
const thousand = 1_000;

export const checks = [
	unset === 1,
	falsy === 2,
	truthy === 3,
	Branded.ready,
	Branded.has(new Branded()) && !Branded.has({}),
	orFive(null) === 5,
	orFive(0) === 0,
	nested?.inner?.value === 6 && nested?.missing?.value === undefined,
	thousand === 10 ** 3,
	/^\p{Lu}\p{Ll}+$/u.test("Émile"),
];
