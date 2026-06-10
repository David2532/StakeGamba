<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';

	import { coinAssetKey, featureWin, type FeatureResult } from '../game/leBanditEngine';

	type Props = {
		result: FeatureResult;
		bet?: number;
		cellSize?: number;
		x?: number;
		y?: number;
		autoPlay?: boolean;
		stepMs?: number;
	};

	const {
		result,
		bet = 1,
		cellSize = 132,
		x = 0,
		y = 0,
		autoPlay = true,
		stepMs = 950,
	}: Props = $props();

	const reels = result.grid.length;
	const rows = result.grid[0]?.length ?? 0;
	const gridW = reels * cellSize;
	const gridH = rows * cellSize;

	let activeStep = $state(-1); // -1 = revealed but not collecting yet
	let finished = $state(false);

	const runningTotal = $derived(
		activeStep >= 0 ? (result.steps[activeStep]?.runningTotal ?? 0) : 0,
	);
	const collecting = $derived(activeStep >= 0 && !finished);
	const keyOf = (p?: { reel: number; row: number }) => (p ? `${p.reel}:${p.row}` : '');
	const activeCollectorKey = $derived(
		activeStep >= 0 ? keyOf(result.steps[activeStep]?.collector) : '',
	);

	const cellX = (reel: number) => x + reel * cellSize + cellSize / 2;
	const cellY = (row: number) => y + row * cellSize + cellSize / 2;
	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	onMount(() => {
		if (!autoPlay || result.steps.length === 0) {
			finished = result.steps.length === 0;
			return;
		}
		let cancelled = false;
		(async () => {
			await sleep(650);
			for (let i = 0; i < result.steps.length; i++) {
				if (cancelled) return;
				activeStep = i;
				await sleep(stepMs);
			}
			if (!cancelled) finished = true;
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<Container {x} y={y - cellSize * 1.05}>
	<!-- header -->
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		x={gridW / 2}
		y={0}
		text="BOUNTY COLLECT"
		style={{ fontFamily: 'proxima-nova', fontSize: 46, fontWeight: '900', fill: 0xf4d276 }}
	/>
</Container>

<!-- feature panel -->
<Rectangle
	anchor={0.5}
	x={x + gridW / 2}
	y={y + gridH / 2}
	width={gridW + cellSize * 0.5}
	height={gridH + cellSize * 0.5}
	backgroundColor={0x06101f}
	backgroundAlpha={0.92}
	borderColor={0xf3c64c}
	borderWidth={6}
	borderRadius={28}
/>

<!-- grid cells -->
{#each result.grid as reelCells, reel}
	{#each reelCells as cell, row}
		{@const isActiveCollector = cell.kind === 'collector' && keyOf({ reel, row }) === activeCollectorKey}
		<Rectangle
			anchor={0.5}
			x={cellX(reel)}
			y={cellY(row)}
			width={cellSize * 0.9}
			height={cellSize * 0.9}
			backgroundColor={0x0a1830}
			backgroundAlpha={0.55}
			borderColor={0x18345c}
			borderWidth={2}
			borderRadius={16}
		/>

		{#if cell.kind === 'multiplier'}
			<Sprite
				key={coinAssetKey(cell.value)}
				anchor={0.5}
				x={cellX(reel)}
				y={cellY(row)}
				width={cellSize * 0.82}
				height={cellSize * 0.82}
			/>
			{#if collecting}
				<!-- collect pulse ring -->
				<Rectangle
					anchor={0.5}
					x={cellX(reel)}
					y={cellY(row)}
					width={cellSize * 0.9}
					height={cellSize * 0.9}
					backgroundAlpha={0}
					borderColor={0xffe070}
					borderWidth={3}
					borderRadius={16}
				/>
			{/if}
		{:else if cell.kind === 'collector'}
			<Sprite
				key="symbolCollector"
				anchor={0.5}
				x={cellX(reel)}
				y={cellY(row)}
				width={cellSize * 0.86}
				height={cellSize * 0.86}
			/>
			{#if isActiveCollector}
				<Rectangle
					anchor={0.5}
					x={cellX(reel)}
					y={cellY(row)}
					width={cellSize * 0.96}
					height={cellSize * 0.96}
					backgroundColor={0xf3c64c}
					backgroundAlpha={0.18}
					borderColor={0xffe070}
					borderWidth={5}
					borderRadius={18}
				/>
			{/if}
		{/if}
	{/each}
{/each}

<!-- running total / win readout -->
<Container x={x + gridW / 2} y={y + gridH + cellSize * 0.55}>
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		text={`${runningTotal}x`}
		style={{ fontFamily: 'proxima-nova', fontSize: 64, fontWeight: '900', fill: 0xffffff }}
	/>
	{#if finished}
		<Text
			anchor={{ x: 0.5, y: 0 }}
			y={44}
			text={`WIN ${featureWin({ totalMultiplier: result.totalMultiplier, bet }).toFixed(2)}`}
			style={{ fontFamily: 'proxima-nova', fontSize: 38, fontWeight: '800', fill: 0x12d36a }}
		/>
	{/if}
</Container>
