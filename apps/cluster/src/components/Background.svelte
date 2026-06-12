<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';

	const context = getContext();
	const showFeatureBackground = $derived(context.stateGame.gameType === 'freegame');
	const canvasSizes = $derived(context.stateLayoutDerived.canvasSizes());

	// Cover-fit the final stadium background (stake-upload master, 1672x941)
	// across the full canvas without overpainting it.
	const slotBackgroundRatio = 1672 / 941;
	const slotBackgroundLayout = $derived.by(() => {
		const { width, height } = canvasSizes;
		const canvasRatio = width / height;
		const backgroundWidth = canvasRatio > slotBackgroundRatio ? width : height * slotBackgroundRatio;
		const backgroundHeight = canvasRatio > slotBackgroundRatio ? width / slotBackgroundRatio : height;

		return {
			x: width * 0.5,
			y: height * 0.5,
			width: backgroundWidth,
			height: backgroundHeight,
		};
	});
</script>

<Rectangle {...canvasSizes} backgroundColor={0x020305} zIndex={-6} />
<Sprite key="slotBackground" {...slotBackgroundLayout} anchor={0.5} zIndex={-5} />

<!-- Subtle warm tint during free spins — keeps the stadium fully visible. -->
<FadeContainer show={showFeatureBackground} duration={SECOND} zIndex={-4}>
	<Rectangle {...canvasSizes} backgroundColor={0x3a1408} backgroundAlpha={0.22} />
</FadeContainer>
