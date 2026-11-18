<!-- A shared package's component: it imports nothing of @sohedra/lynx. -->
<script lang="ts">
	const uid = $props.id();
</script>

<view class="shared-field" id={uid}><text aria-labelledby={uid}>Name</text></view>
