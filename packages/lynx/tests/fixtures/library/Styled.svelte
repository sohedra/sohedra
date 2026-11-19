<script lang="ts">
	import "./styled.css";
	import styles from "./styled.module.css";
</script>

<view class="card" data-module={styles["card"]}>
	<text>Styled</text>
</view>

<style>
	.card {
		color: red;
	}
	.card > text {
		font-size: 12px;
	}
</style>
