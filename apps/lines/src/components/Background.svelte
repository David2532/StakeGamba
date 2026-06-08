<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';

	const context = getContext();
	const showBaseBackground = $derived(context.stateGame.gameType === 'basegame');
	const showFeatureBackground = $derived(context.stateGame.gameType === 'freegame');
	const canvasSizes = $derived(context.stateLayoutDerived.canvasSizes());
	const backgroundRatio = 1672 / 941;
	const cover = $derived.by(() => {
		const { width, height } = canvasSizes;
		const canvasRatio = width / height;
		return canvasRatio > backgroundRatio
			? { width, height: width / backgroundRatio }
			: { width: height * backgroundRatio, height };
	});
</script>

<Rectangle {...canvasSizes} backgroundColor={0x020305} zIndex={-5} />

<FadeContainer show={showBaseBackground} duration={SECOND} zIndex={-4}>
	<Sprite
		key="slotBackground"
		anchor={0.5}
		x={canvasSizes.width * 0.5}
		y={canvasSizes.height * 0.5}
		width={cover.width}
		height={cover.height}
	/>
	<Rectangle {...canvasSizes} backgroundColor={0x001026} backgroundAlpha={0.24} />
</FadeContainer>

<FadeContainer show={showFeatureBackground} duration={SECOND} zIndex={-3}>
	<Sprite
		key="slotBackground"
		anchor={0.5}
		x={canvasSizes.width * 0.5}
		y={canvasSizes.height * 0.5}
		width={cover.width}
		height={cover.height}
	/>
	<Rectangle {...canvasSizes} backgroundColor={0x000c20} backgroundAlpha={0.38} />
</FadeContainer>
