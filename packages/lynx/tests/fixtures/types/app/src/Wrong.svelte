<!-- What must not type-check: each line below the script is one error, which the test names. -->
<script lang="ts">
	import type { LynxScrollEvent } from "@sohedra/lynx/elements";

	const scrolled = (event: LynxScrollEvent) => void event;
</script>

<div></div>
<view ontpa={() => {}}></view>
<view bindtap={() => {}}></view>
<view ontap={scrolled}></view>
<text ontap={(event) => event.stopPropagation()}></text>
<input value={3} />
<view main-thread:ref="box"></view>
<view main-thread:ontap={(event) => void event.preventDefault()}></view>
<scroll-view {@attach (node) => void node.invoke("setValue", { value: "a" })}></scroll-view>
<overlay level={7}></overlay>
<frame src="a"></frame>
