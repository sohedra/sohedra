<script lang="ts">
	// A main-thread tap handler that changes its element a promise reaction later, as an app's
	// would after an await: the main thread flushes the change at the end of the tap's task.
</script>

<view
	class="box"
	main-thread:ontap={(event) => {
		"main thread";
		void Promise.resolve().then(() => event.currentTarget.setStyleProperty("opacity", "0.5"));
	}}
></view>
