<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Rectangle, Graphics, Text, Container, SpineProvider, SpineTrack } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS } from '../game/constants';

	const context = getContext();
	const SPINE_SCALE = { width: 0.6, height: 0.6 };
	// Frame paddings around the symbol area (mockup: thick gold outer frame,
	// thin inner line, fine gold grid lines).
	const FRAME_PAD = 26;

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

	const layout = $derived(context.stateGameDerived.boardLayout());
</script>

{#if animationName}
	<SpineProvider
		zIndex={-1}
		key="reelhouse"
		x={layout.x}
		y={layout.y}
		width={layout.width * SPINE_SCALE.width}
		height={layout.height * SPINE_SCALE.height}
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

<!-- Soft gold halo behind the frame (subtle, keeps the stadium visible). -->
<Rectangle
	anchor={0.5}
	x={layout.x}
	y={layout.y}
	width={layout.width + FRAME_PAD * 2 + 26}
	height={layout.height + FRAME_PAD * 2 + 26}
	backgroundColor={0xc8921e}
	backgroundAlpha={0.14}
	borderRadius={30}
/>

<!-- Board panel: dark glass with the thick gold mockup frame. -->
<Rectangle
	anchor={0.5}
	x={layout.x}
	y={layout.y}
	width={layout.width + FRAME_PAD * 2}
	height={layout.height + FRAME_PAD * 2}
	backgroundColor={0x07070c}
	backgroundAlpha={0.88}
	borderRadius={22}
	borderColor={0xd5a23b}
	borderWidth={7}
/>
<Rectangle
	anchor={0.5}
	x={layout.x}
	y={layout.y}
	width={layout.width + FRAME_PAD * 0.9}
	height={layout.height + FRAME_PAD * 0.9}
	backgroundColor={0x000000}
	backgroundAlpha={0}
	borderRadius={16}
	borderColor={0xffe49a}
	borderAlpha={0.55}
	borderWidth={2}
/>

<!-- Fine gold grid lines between the 6x5 cells. -->
<Graphics
	alpha={0.28}
	draw={(g) => {
		const left = layout.x - layout.width / 2;
		const top = layout.y - layout.height / 2;
		const cellW = layout.width / BOARD_DIMENSIONS.x;
		const cellH = layout.height / BOARD_DIMENSIONS.y;
		for (let i = 1; i < BOARD_DIMENSIONS.x; i += 1) {
			g.moveTo(left + i * cellW, top + 4);
			g.lineTo(left + i * cellW, top + layout.height - 4);
		}
		for (let j = 1; j < BOARD_DIMENSIONS.y; j += 1) {
			g.moveTo(left + 4, top + j * cellH);
			g.lineTo(left + layout.width - 4, top + j * cellH);
		}
		g.stroke({ color: 0xd5a23b, width: 1.5 });
	}}
/>

<!-- Side mechanic panels (mockup style) — honest text for cluster pays. -->
{#each [-1, 1] as side (side)}
	<Container x={layout.x + side * (layout.width / 2 + FRAME_PAD + 34)} y={layout.y}>
		<Rectangle
			anchor={0.5}
			width={56}
			height={210}
			borderRadius={16}
			backgroundColor={0x0b0b10}
			backgroundAlpha={0.92}
			borderColor={0xd5a23b}
			borderWidth={3}
		/>
		<Text
			anchor={{ x: 0.5, y: 0 }}
			y={-86}
			text={'C\nL\nU\nS\nT\nE\nR'}
			style={{
				align: 'center',
				fontFamily: 'proxima-nova',
				fontWeight: '700',
				fontSize: 16,
				lineHeight: 24,
				fill: 0xffe49a,
			}}
		/>
	</Container>
{/each}
