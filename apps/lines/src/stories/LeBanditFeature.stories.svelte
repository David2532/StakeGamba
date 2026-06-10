<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Components/<Le Bandit Feature>',
	});
</script>

<script lang="ts">
	import { StoryPixiApp } from 'components-storybook';

	import LeBanditFeature from '../components/LeBanditFeature.svelte';
	import assets from '../game/assetsPreview';
	import { evaluateCollect, generateFeatureGrid, type FeatureGrid } from '../game/leBanditEngine';

	const B = { kind: 'blank' } as const;
	const C = { kind: 'collector' } as const;
	const M = (value: number) => ({ kind: 'multiplier', value }) as const;

	// Deterministic showcase grid: 8 multipliers (sum 200) + 2 collectors => 400x total.
	const sampleGrid: FeatureGrid = [
		[B, M(2), B, M(10)],
		[C, B, M(5), B],
		[B, M(25), B, M(3)],
		[M(50), B, C, B],
		[B, M(5), B, M(100)],
	];
	const sampleResult = evaluateCollect(sampleGrid);

	const randomResult = evaluateCollect(
		generateFeatureGrid({ reels: 5, rows: 4, multiplierCount: 7, collectorCount: 2 }),
	);
</script>

<Story name="collect demo">
	{#snippet template()}
		<StoryPixiApp {assets}>
			<LeBanditFeature result={sampleResult} bet={1} x={140} y={190} cellSize={120} />
		</StoryPixiApp>
	{/snippet}
</Story>

<Story name="collect random">
	{#snippet template()}
		<StoryPixiApp {assets}>
			<LeBanditFeature result={randomResult} bet={1} x={140} y={190} cellSize={120} />
		</StoryPixiApp>
	{/snippet}
</Story>
