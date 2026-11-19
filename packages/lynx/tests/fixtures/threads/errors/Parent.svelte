<!-- A tap changes the count its child's effect throws on. -->
<script lang="ts">
	import Child from "./Child.svelte";

	let count = $state(0);
</script>

<view class="more" ontap={() => count++}></view>
<Child {count} />
