<!-- A page whose effect throws as the page starts, after its markup is in place. -->
<script lang="ts">
	$effect(() => {
		throw new Error("the effect threw as the page started");
	});
</script>

<view></view>
