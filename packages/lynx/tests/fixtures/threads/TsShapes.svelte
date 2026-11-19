<script lang="ts">
	// TypeScript inside a main-thread function, in the shapes a hand-written stripper got wrong: each
	// value the function computes is what TypeScript means, and a tap shows them all.
	import { runOnBackground } from "@sohedra/lynx";

	let shown = $state("");
	const show = (text: string): void => {
		shown = text;
	};

	function probe() {
		"main thread";
		// Type parameters across lines after `return`: the arrow is returned.
		// prettier-ignore
		const make = () => {
			return <
				T,
			>(x: T) => x;
		};
		// Without semicolons: two statements, the second a call.
		// prettier-ignore
		const twice = () => {
			const e = (() => 7) as never
			const v = e as never
			(e as never)()
			return typeof v
		};
		// A return type across lines.
		const g = (
			a: number,
		): {
			x: number;
		} => ({ x: a });
		// prettier-ignore
		function only(this: unknown,) { return 4 }
		// prettier-ignore
		const dotted = (5 as assets.Icon);
		// prettier-ignore
		const commented = (6 as /* cast */ number);
		abstract class Base {
			abstract m(): number;
		}
		interface Named {
			name?: string;
		}
		class Box extends Base implements Named {
			private readonly size: number = 3;
			name?: string;
			declare extra: number;
			late!: number;
			override m(): number {
				return this.size;
			}
			pick(a: string): string;
			pick(a: unknown): unknown {
				return a;
			}
		}
		const values = [
			typeof make(),
			twice(),
			g(2).x,
			only.call(null),
			dotted,
			commented,
			new Box().m(),
			new Box().pick("p"),
		];
		void runOnBackground(show)(values.join(" "));
	}
</script>

<view class="probe" main-thread:ontap={probe}>
	<text>shapes {shown}</text>
</view>
