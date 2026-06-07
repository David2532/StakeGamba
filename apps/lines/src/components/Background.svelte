<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';

	const context = getContext();
	const canvasSizes = $derived(context.stateLayoutDerived.canvasSizes());
	const showBaseBackground = $derived(context.stateGame.gameType === 'basegame');
	const showFeatureBackground = $derived(context.stateGame.gameType === 'freegame');
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x000000} zIndex={-3} />

<!-- Golden Goal Rush: night-stadium background (placeholder) -->
<FadeContainer show={showBaseBackground} duration={SECOND} zIndex={-2}>
	<Sprite key="ggrBackground" anchor={{ x: 0, y: 0 }} x={0} y={0} width={canvasSizes.width} height={canvasSizes.height} />
</FadeContainer>

<FadeContainer show={showFeatureBackground} duration={SECOND} zIndex={-1}>
	<Sprite key="ggrBackground" anchor={{ x: 0, y: 0 }} x={0} y={0} width={canvasSizes.width} height={canvasSizes.height} />
</FadeContainer>
