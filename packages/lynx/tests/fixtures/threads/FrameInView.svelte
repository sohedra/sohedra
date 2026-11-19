<script lang="ts">
	// A Lynx `<frame>` inside a `<view>`, across a component's edge: Svelte's development server
	// checks HTML's nesting rules there, where `<frame>` may only be in a `<frameset>`.
	import Framed from "./Framed.svelte";
</script>

<view class="outer"><Framed /></view>
