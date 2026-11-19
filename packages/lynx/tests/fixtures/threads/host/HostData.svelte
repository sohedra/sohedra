<!-- Shows what the host gives the page as values. -->
<script lang="ts">
	import { globalProps, initData, systemInfo } from "@sohedra/lynx/host";
</script>

<view class="page">
	<text class="title">{String(initData.current["title"])}</text>
	<text class="theme">{String(globalProps.current["theme"])}</text>
	<text class="platform">{systemInfo.current.platform}</text>
</view>
