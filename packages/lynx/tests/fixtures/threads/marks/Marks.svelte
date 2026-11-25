<!--
	Every place a branch mark goes: the root, a parent made while its children are written,
	components three deep, a list's cells, a list in a cell, deferred rows, and texts in a <text>.
-->
<script lang="ts">
	import Deep from "./Deep.svelte";
	let {
		user = null,
		flag = false,
		rows = ["a", "b"],
		log,
	}: { user?: string | null; flag?: boolean; rows?: string[]; log: unknown[] } = $props();
</script>

{#if user}<text class="root-user" ontap={() => log.push("root-user")}>{user}</text>{:else}<text
		class="root-guest"
		ontap={() => log.push("root-guest")}>log in</text
	>{/if}
<view class="pending">
	{#if flag}<text class="flag">flag</text>{/if}
	<text class="fixed" ontap={() => log.push("fixed")}>fixed</text>
	{#if user}{#if flag}<text class="both">both</text>{:else if rows.length > 1}<text class="many"
				>many</text
			>{/if}{/if}
	<Deep {flag} {log} />
</view>
<list class="page-list" custom-list-name="list-container" initial-item-count={4}>
	{#each rows as row (row)}
		<list-item item-key="row-{row}">
			{#if row === "a"}<text class="cell-a" ontap={() => log.push("cell-a")}>A</text>{:else}<text
					class="cell-other">{row}</text
				>{/if}
			<list class="inner-{row}" custom-list-name="list-container">
				{#each [1, 2] as n (n)}
					<list-item item-key="in-{n}"
						>{#if n === 1 && user}<text class="in-user">{n}</text>{/if}<text class="in">{n}</text
						></list-item
					>
				{/each}
				<list-item item-key="in-deferred" defer
					>{#if flag}<text class="in-deferred-flag">f</text>{/if}<text class="in-deferred">d</text
					></list-item
				>
			</list>
		</list-item>
	{/each}
	<list-item item-key="deferred" defer
		>{#if user}<text class="deferred-user">{user}</text>{/if}<text class="deferred">deferred</text
		></list-item
	>
</list>
<text class="texts"
	>{#if user}Hi {user}{:else}Hello{/if}!</text
>
