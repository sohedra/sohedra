<!-- Rows whose function ref throws for one row, and a page element whose ref throws first. -->
<script lang="ts">
	interface Element {
		readonly dataset: Record<string, unknown>;
		setAttribute(name: string, value: unknown): void;
		invoke(method: string): Promise<unknown>;
	}

	let { api }: { api: Record<string, unknown> } = $props();
	const rows = [1, 2, 3, 4];
	let late = $state(false);

	function attach(element: Element) {
		"main thread";
		if (element.dataset["id"] === 2) throw new Error("The row's ref threw.");
		element.setAttribute("attached", "yes");
	}

	function first() {
		"main thread";
		throw new Error("The first ref threw.");
	}

	function second(element: Element) {
		"main thread";
		element.setAttribute("second", "ran");
	}

	function measured(element: Element) {
		"main thread";
		element.invoke("boundingClientRect").then(
			() => element.setAttribute("measured", "yes"),
			(error: { code?: string }) => element.setAttribute("measured", error.code ?? "?"),
		);
	}

	api["late"] = () => (late = true);
</script>

<list class="list">
	{#each rows as id (id)}
		<list-item item-key="r{id}">
			<view class="row row-{id}" data-id={id} main-thread:ref={attach}><text>row {id}</text></view>
			<view class="measured measured-{id}" main-thread:ref={measured}></view>
		</list-item>
	{/each}
</list>
{#if late}
	<view class="first" main-thread:ref={first}></view>
	<view class="second" main-thread:ref={second}></view>
	<text class="after">after</text>
{/if}
