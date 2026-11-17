<script lang="ts">
	const uid = $props.id();
</script>

<view class="labeled" id={uid} accessibility-label={`label-${uid}`}><text>{uid}</text></view>
