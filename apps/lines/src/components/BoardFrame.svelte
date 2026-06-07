<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Rectangle, SpineProvider, SpineTrack } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const SPINE_SCALE = { width: 0.62, height: 0.66 };
	const FRAME_SCALE = { width: 1.32, height: 1.38 };
	const INNER_SCALE = { width: 1.08, height: 1.08 };
	const POSITION_ADJUSTMENT = 1.01;

	type AnimationName = 'reelhouse_glow_start' | 'reelhouse_glow_idle' | 'reelhouse_glow_exit';

	let animationName = $state<AnimationName | undefined>(undefined);
	let loop = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => {
			animationName = 'reelhouse_glow_start';
			loop = false;
		},
		boardFrameGlowHide: () => {
			if (animationName) animationName = 'reelhouse_glow_exit';
		},
	});
</script>

{#if animationName}
	<SpineProvider
		zIndex={-1}
		key="reelhouse"
		x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
		y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
		width={context.stateGameDerived.boardLayout().width * SPINE_SCALE.width}
		height={context.stateGameDerived.boardLayout().height * SPINE_SCALE.height}
	>
		<SpineTrack
			trackIndex={0}
			{animationName}
			{loop}
			listener={{
				complete: (entry) => {
					if (entry.animation) {
						if (entry.animation.name === 'reelhouse_glow_start') {
							animationName = 'reelhouse_glow_idle';
							loop = true;
						}

						if (entry.animation.name === 'reelhouse_glow_exit') {
							animationName = undefined;
							loop = false;
						}
					}
				},
			}}
		/>
	</SpineProvider>
{/if}

<!-- Outer ambient glow ring — very subtle warm gold halo behind the frame -->
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * (FRAME_SCALE.width + 0.14)}
	height={context.stateGameDerived.boardLayout().height * (FRAME_SCALE.height + 0.18)}
	backgroundColor={0xc8821a}
	backgroundAlpha={0.12}
	borderRadius={44}
	borderColor={0xc8821a}
	borderWidth={0}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * FRAME_SCALE.width}
	height={context.stateGameDerived.boardLayout().height * FRAME_SCALE.height}
	backgroundColor={0x07060a}
	backgroundAlpha={0.98}
	borderRadius={34}
	borderColor={0x1a1015}
	borderWidth={14}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * (FRAME_SCALE.width - 0.08)}
	height={context.stateGameDerived.boardLayout().height * (FRAME_SCALE.height - 0.12)}
	backgroundColor={0x0e0306}
	backgroundAlpha={0.96}
	borderRadius={28}
	borderColor={0xf2c040}
	borderWidth={12}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * INNER_SCALE.width}
	height={context.stateGameDerived.boardLayout().height * INNER_SCALE.height}
	backgroundColor={0x070610}
	backgroundAlpha={0.88}
	borderRadius={18}
	borderColor={0x8a1428}
	borderWidth={5}
/>

<!-- Gold top accent bar (glow effect via two overlapping bars) -->
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y -
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.96}
	height={18}
	backgroundColor={0xf0c040}
	backgroundAlpha={0.28}
	borderRadius={12}
/>
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y -
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.88}
	height={10}
	backgroundColor={0xffd86a}
	backgroundAlpha={0.92}
	borderRadius={8}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y +
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.88}
	height={10}
	backgroundColor={0xd42038}
	backgroundAlpha={0.95}
	borderRadius={8}
/>
<!-- Red bottom accent outer glow -->
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y +
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.96}
	height={18}
	backgroundColor={0xc5192e}
	backgroundAlpha={0.22}
	borderRadius={12}
/>
