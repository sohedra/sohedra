// Svelte behaviour the stores' class fields rely on, checked headless: a lazy `$derived` reading a
// `#private` field, and a writable `$derived`.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

/** A lens declared before the constructor assigns the `#private` field it reads. */
class Lens {
	readonly doubled = $derived.by(() => this.#source.value * 2);
	#source: { value: number };
	constructor(source: { value: number }) {
		this.#source = source;
	}
}

/** A writable derived: follows its prop, and takes local writes until the prop changes. */
class Highlight {
	#props: { selected: number };
	index = $derived.by(() => this.#props.selected);
	constructor(props: { selected: number }) {
		this.#props = props;
	}
	move = (next: number) => {
		this.index = next;
	};
}

describe("class field patterns", () => {
	it("lazy $derived lenses may read a #private field the constructor assigns later", () => {
		const source = $state({ value: 2 });
		const lens = new Lens(source);
		expect(lens.doubled).toBe(4);
		source.value = 5;
		expect(lens.doubled).toBe(10);
	});

	it("a writable $derived field takes local writes and resets when its dependency changes", () => {
		const props = $state({ selected: 1 });
		const highlight = new Highlight(props);
		expect(highlight.index).toBe(1);
		highlight.move(3);
		expect(highlight.index).toBe(3);
		props.selected = 2;
		flushSync();
		expect(highlight.index).toBe(2);
	});
});
