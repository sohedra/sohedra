<script lang="ts">
	// A custom property in an element's `style`, which its child resolves, and styles from code.
	type Node = { setStyleProperties(styles: Record<string, string | null>): void };
	let { handles, atMount }: { handles: Record<string, unknown>; atMount?: Record<string, string> } =
		$props();
	let tone = $state<string | null>("red");
	handles["retone"] = (next: string | null) => (tone = next);
</script>

<view
	class="toned"
	style={tone ? `--tone: ${tone}` : ""}
	{@attach (node) => {
		handles["toned"] = node;
		if (atMount) (node as Node).setStyleProperties(atMount);
	}}
>
	<view class="toned-child"></view>
</view>
