<!-- The layer a generated page's step mounts above it: a tap that changes its own text. -->
<script lang="ts">
	let taps = $state(0);
</script>

<view class="layer" ontap={() => taps++}><text>layer {taps}</text></view>
