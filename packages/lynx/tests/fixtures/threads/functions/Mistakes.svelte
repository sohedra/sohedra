<!--
	Mistakes the binding names in a development build: a plain function where a main-thread one
	goes, Lynx's own spelling of an event through a spread, and an attribute that binds nothing.
-->
<script lang="ts">
	function plainTap() {}

	function later() {
		"main thread";
		}
</script>

<view class="plain" main-thread:ontap={plainTap}></view>
<view class="removed" {...{ "main-thread:bindtap": later }}></view>
<view class="unknown" {...{ "main-thread:later": later }}></view>
