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

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * FRAME_SCALE.width}
	height={context.stateGameDerived.boardLayout().height * FRAME_SCALE.height}
	backgroundColor={0x07060a}
	backgroundAlpha={0.98}
	borderRadius={34}
	borderColor={0x1b1112}
	borderWidth={16}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * (FRAME_SCALE.width - 0.08)}
	height={context.stateGameDerived.boardLayout().height * (FRAME_SCALE.height - 0.12)}
	backgroundColor={0x120407}
	backgroundAlpha={0.95}
	borderRadius={28}
	borderColor={0xd5a23b}
	borderWidth={10}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * INNER_SCALE.width}
	height={context.stateGameDerived.boardLayout().height * INNER_SCALE.height}
	backgroundColor={0x090910}
	backgroundAlpha={0.82}
	borderRadius={18}
	borderColor={0x6f111f}
	borderWidth={4}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y -
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.92}
	height={9}
	backgroundColor={0xffe49a}
	backgroundAlpha={0.82}
	borderRadius={8}
/>

<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y +
		context.stateGameDerived.boardLayout().height * 0.77) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.92}
	height={9}
	backgroundColor={0xc5192e}
	backgroundAlpha={0.9}
	borderRadius={8}
/>
