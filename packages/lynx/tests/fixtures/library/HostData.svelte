<script lang="ts">
	import { globalProps, initData } from "@sohedra/lynx/host";
</script>

<text
	>{`route ${String(initData.current["route"])}, theme ${String(globalProps.current["theme"])}`}</text
>
