<script lang="ts">
	// `main-thread:ref` given what is neither a ref nor a main-thread function: `kind` says what (a
	// plain function, text, an object that is not a ref, a number). Without one the element has a
	// ref, which is fine.
	import { mainThreadRef } from "@sohedra/lynx";

	let { kind = "ref" }: { kind?: string } = $props();

	const ok = mainThreadRef<unknown>(null);
	const values: Record<string, unknown> = {
		ref: ok,
		plain: () => 1,
		text: "not a ref",
		object: { current: null },
		number: 3,
	};
</script>

<view class="box" main-thread:ref={values[kind] as never}></view>
