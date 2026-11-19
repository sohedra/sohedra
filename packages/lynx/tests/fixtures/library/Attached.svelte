<script lang="ts">
	// An action with `use:`: it gets the element's node once it is made, and its `update` and
	// `destroy` follow the parameter and the element.
	import type { LynxNode } from "@sohedra/lynx/elements";

	let {
		log,
		label = "first",
		shown = true,
	}: { log: unknown[]; label?: string; shown?: boolean } = $props();

	function marked(node: LynxNode, text: string) {
		node.setAttribute("marked", text);
		log.push(`made ${node.tag} ${text}`);
		return {
			update(next: string) {
				node.setAttribute("marked", next);
				log.push(`update ${next}`);
			},
			destroy() {
				log.push("destroy");
			},
		};
	}
</script>

{#if shown}
	<view class="box" use:marked={label}></view>
{/if}
