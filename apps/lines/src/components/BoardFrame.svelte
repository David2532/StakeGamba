<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Rectangle, Graphics, Text, Container, SpineProvider, SpineTrack } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const SPINE_SCALE = { width: 0.62, height: 0.66 };
	const FRAME_SCALE = { width: 1.18, height: 1.2 };
	const INNER_SCALE = { width: 1.08, height: 1.08 };
	const POSITION_ADJUSTMENT = 1;
	const ACCENT_OFFSET_RATIO = 0.6;

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
	backgroundColor={0x0a0712}
	backgroundAlpha={0.94}
	borderRadius={18}
	borderColor={0x2a1c10}
	borderWidth={3}
/>

<!-- Gold top accent bar (glow effect via two overlapping bars) -->
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y -
		context.stateGameDerived.boardLayout().height * ACCENT_OFFSET_RATIO) *
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
		context.stateGameDerived.boardLayout().height * ACCENT_OFFSET_RATIO) *
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
		context.stateGameDerived.boardLayout().height * ACCENT_OFFSET_RATIO) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.88}
	height={8}
	backgroundColor={0x7a121f}
	backgroundAlpha={0.5}
	borderRadius={8}
/>
<!-- Red bottom accent outer glow (muted, no neon) -->
<Rectangle
	anchor={0.5}
	x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	y={(context.stateGameDerived.boardLayout().y +
		context.stateGameDerived.boardLayout().height * ACCENT_OFFSET_RATIO) *
		POSITION_ADJUSTMENT}
	width={context.stateGameDerived.boardLayout().width * 0.96}
	height={16}
	backgroundColor={0x4a0c14}
	backgroundAlpha={0.12}
	borderRadius={12}
/>

<!-- Gold corner accent diamonds — one per frame corner for premium casino look -->
<Graphics
	draw={(g) => {
		const bx = context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT;
		const by = context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT;
		const bw = context.stateGameDerived.boardLayout().width;
		const bh = context.stateGameDerived.boardLayout().height;
		const fw = bw * (FRAME_SCALE.width - 0.08);
		const fh = bh * (FRAME_SCALE.height - 0.12);
		const s = 10; // diamond half-size

		// corners: top-left, top-right, bottom-left, bottom-right
		const corners = [
			[bx - fw / 2, by - fh / 2],
			[bx + fw / 2, by - fh / 2],
			[bx - fw / 2, by + fh / 2],
			[bx + fw / 2, by + fh / 2],
		] as const;

		for (const [cx, cy] of corners) {
			// Outer soft halo — very subtle
			g.ellipse(cx, cy, s * 2.0, s * 2.0);
			g.fill({ color: 0xc8921e, alpha: 0.08 });
			// Diamond shape — muted brushed gold, no harsh white core
			g.moveTo(cx,     cy - s);
			g.lineTo(cx + s, cy);
			g.lineTo(cx,     cy + s);
			g.lineTo(cx - s, cy);
			g.closePath();
			g.fill({ color: 0xc79a3c, alpha: 0.5 });
		}
	}}
/>

<!-- Side mechanic panels (mockup style) — honest "20 LINES" for the real math. -->
{#each [-1, 1] as side (side)}
	{@const bx = context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
	{@const by = context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
	{@const fw = context.stateGameDerived.boardLayout().width * FRAME_SCALE.width}
	<Container x={bx + side * (fw / 2 + 36)} y={by}>
		<Rectangle
			anchor={0.5}
			width={58}
			height={196}
			borderRadius={16}
			backgroundColor={0x0b0b10}
			backgroundAlpha={0.92}
			borderColor={0xd5a23b}
			borderWidth={3}
		/>
		<Text
			anchor={0.5}
			y={-62}
			text="20"
			style={{
				fontFamily: 'proxima-nova',
				fontWeight: '800',
				fontSize: 32,
				fill: 0xffe49a,
			}}
		/>
		<Text
			anchor={{ x: 0.5, y: 0 }}
			y={-34}
			text={'L\nI\nN\nE\nS'}
			style={{
				align: 'center',
				fontFamily: 'proxima-nova',
				fontWeight: '700',
				fontSize: 17,
				lineHeight: 22,
				fill: 0xd5a23b,
			}}
		/>
	</Container>
{/each}
