<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Rectangle, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const FRAME_SCALE = { width: 1.18, height: 1.2 };
	const INNER_SCALE = { width: 1.08, height: 1.08 };
	const POSITION_ADJUSTMENT = 1;
	const ACCENT_OFFSET_RATIO = 0.6;

	let glowShow = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowShow = true),
		boardFrameGlowHide: () => (glowShow = false),
	});
</script>

{#if glowShow}
	<Rectangle
		anchor={0.5}
		x={context.stateGameDerived.boardLayout().x * POSITION_ADJUSTMENT}
		y={context.stateGameDerived.boardLayout().y * POSITION_ADJUSTMENT}
		width={context.stateGameDerived.boardLayout().width * 1.36}
		height={context.stateGameDerived.boardLayout().height * 1.38}
		backgroundColor={0x47b9ff}
		backgroundAlpha={0.14}
		borderRadius={54}
		borderColor={0xffd447}
		borderWidth={8}
		borderAlpha={0.65}
	/>
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
