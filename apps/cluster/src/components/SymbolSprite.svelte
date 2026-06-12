<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Container, Circle, Sprite } from 'pixi-svelte';

	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_SIZE } from '../game/constants';
	import { onMount } from 'svelte';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		win?: boolean;
		oncomplete?: () => void;
	};

	const props: Props = $props();

	// Premium win presentation: gold glow + quick scale pop before completing.
	const scaleTween = new Tween(1, { duration: 180, easing: cubicOut });
	const glowTween = new Tween(0, { duration: 180 });

	let running = false;
	const playWinPulse = async () => {
		if (running) return;
		running = true;
		glowTween.set(0.5);
		await scaleTween.set(1.18);
		await scaleTween.set(1);
		await scaleTween.set(1.12);
		await scaleTween.set(1);
		await glowTween.set(0);
		running = false;
		props.oncomplete?.();
	};

	onMount(() => {
		if (!props.win) props.oncomplete?.();
	});

	$effect(() => {
		props.symbolInfo;
		if (props.win) {
			playWinPulse();
		} else {
			props.oncomplete?.();
		}
	});
</script>

<Container x={props.x} y={props.y} scale={scaleTween.current}>
	{#if props.win}
		<Circle
			anchor={0.5}
			diameter={SYMBOL_SIZE * 1.15}
			backgroundColor={0xffd86a}
			backgroundAlpha={glowTween.current}
		/>
	{/if}
	<Sprite
		anchor={0.5}
		key={props.symbolInfo.assetKey}
		width={SYMBOL_SIZE * props.symbolInfo.sizeRatios.width}
		height={SYMBOL_SIZE * props.symbolInfo.sizeRatios.height}
	/>
</Container>
