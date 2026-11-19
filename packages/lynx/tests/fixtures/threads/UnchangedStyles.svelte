<script lang="ts">
	let taps = $state(0);
	let tone = $state("calm");
	let color = $state("red");
</script>

<view class="tapped {tone}" style="color: {color};" ontap={() => taps++}>
	<text>{taps}</text>
</view>
<view
	class="restyle"
	ontap={() => {
		tone = "loud";
		color = "blue";
	}}
></view>
