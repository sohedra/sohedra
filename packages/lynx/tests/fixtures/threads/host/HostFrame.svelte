<!-- Draws the first frame from what the host gives the page. -->
<script lang="ts">
	import { globalProps, initData, keyboard, systemInfo } from "@sohedra/lynx/host";
</script>

<view class="page">
	<text class="title">{String(initData.current["title"])}</text>
	<text class="theme">{String(globalProps.current["theme"])}</text>
	<text class="platform">{systemInfo.current.platform}</text>
	<text class="keyboard">{keyboard.current.open} {keyboard.current.height}</text>
</view>
