// A rune module with a class whose field is state: TypeScript's types stripped, the field kept a
// field, as the compiler needs it.

export class Counter {
	count: number = $state(0);
	private readonly step: number;

	constructor(step: number) {
		this.step = step;
	}

	add(): void {
		this.count += this.step;
	}
}
