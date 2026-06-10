<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<Slot Preview>',
	});
</script>

<script lang="ts">
	import { StoryPixiApp } from 'components-storybook';

	import SlotPreview from '../components/SlotPreview.svelte';
	import assets from '../game/assetsPreview';
</script>

<!-- Static 6x5 board with symbols (no HUD) -->
<Story name="board">
	{#snippet template()}
		<StoryPixiApp {assets}>
			<SlotPreview view="board" showHud={false} />
		</StoryPixiApp>
	{/snippet}
</Story>

<!-- Full slot: board + HUD + working SPIN (client-side reshuffle, never freezes) -->
<Story name="slot">
	{#snippet template()}
		<StoryPixiApp {assets}>
			<SlotPreview view="slot" showHud={true} />
		</StoryPixiApp>
	{/snippet}
</Story>
