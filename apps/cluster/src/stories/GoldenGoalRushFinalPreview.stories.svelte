<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'GOLDEN GOAL RUSH/Final Direction',
		parameters: {
			layout: 'fullscreen',
			viewport: {
				defaultViewport: 'stake',
			},
		},
	});
</script>

<script lang="ts">
	import GoldenGoalRushFinalPreview from '../components/GoldenGoalRushFinalPreview.svelte';
</script>

<Story name="Preview 1200x675" exportName="preview1200x675">
	<GoldenGoalRushFinalPreview />
</Story>
