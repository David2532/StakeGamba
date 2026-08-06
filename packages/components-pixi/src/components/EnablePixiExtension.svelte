<script lang="ts">
	import { getContextApp } from 'pixi-svelte';

	const context = getContextApp();
	const pixiGlobal = globalThis as typeof globalThis & {
		__PIXI_APP__?: typeof context.stateApp.pixiApplication;
	};

	pixiGlobal.__PIXI_APP__ = context.stateApp.pixiApplication;
</script>
