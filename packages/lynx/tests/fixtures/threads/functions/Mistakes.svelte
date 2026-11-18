<!-- Mistakes the binding names in a development build: a plain function where a main-thread one goes, and an attribute that binds nothing. -->
<script lang="ts">
	function plainTap() {}

	function later() {
		"main thread";
		}
</script>

<view class="plain" main-thread:ontap={plainTap}></view>
<view class="unknown" {...{ "main-thread:later": later }}></view>
