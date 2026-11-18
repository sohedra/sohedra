<script lang="ts">
	import * as env from "@sohedra/lynx/env";
	import { background, mainThread as main } from "@sohedra/lynx/env";

	import FrameLabeled from "./FrameLabeled.svelte";
	import FrameSlot from "./FrameSlot.svelte";

	let { handles = {} }: { handles?: { open?: (value: boolean) => void } } = $props();
	let open = $state(false);
	handles.open = (value) => (open = value);
</script>

{#snippet piece()}{#if main}<FrameLabeled />{:else}<FrameLabeled />{/if}{/snippet}
{#snippet labeled()}<FrameLabeled />{/snippet}

<!-- Each part in its own view, so that hydration matches the elements of one part at a time. -->
<view class="part"
	>{#if background}<FrameLabeled />{:else}<FrameLabeled />{/if}<FrameLabeled /></view
>
<view class="part"
	>{#each ["a", "b"] as item (item)}{#if background}<FrameLabeled />{/if}{/each}<FrameLabeled
	/></view
>
<FrameSlot
	>{#if !background}<FrameLabeled />{/if}<FrameLabeled /></FrameSlot
>
<view class="part"
	>{#if env.background}{#if open}<FrameLabeled />{/if}{/if}{@render piece()}<FrameLabeled /></view
>
<view class="part"
	>{#if background}{@render labeled()}{/if}<FrameLabeled /></view
>
