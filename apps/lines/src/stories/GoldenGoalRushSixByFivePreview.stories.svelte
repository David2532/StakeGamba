<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'GOLDEN GOAL RUSH/6x5 Pixi Board',
	});
</script>

<script lang="ts">
	import { StoryPixiApp } from 'components-storybook';

	import GoldenGoalRushSixByFivePreview from '../components/GoldenGoalRushSixByFivePreview.svelte';
	import { goldenGoalRushSixByFivePreviewPixiAssets } from '../game/goldenGoalRushAssetMap';
</script>

<Story name="visual test harness">
	<StoryPixiApp assets={goldenGoalRushSixByFivePreviewPixiAssets}>
		<GoldenGoalRushSixByFivePreview />
	</StoryPixiApp>
</Story>

<style>
	:global(html),
	:global(body),
	:global(#storybook-root) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
		background: #020604;
	}
</style>
