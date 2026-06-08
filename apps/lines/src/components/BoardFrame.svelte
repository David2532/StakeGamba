<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	let glowShow = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowShow = true),
		boardFrameGlowHide: () => (glowShow = false),
	});
</script>

<Graphics
	draw={(g) => {
		const { x, y, width, height } = context.stateGameDerived.boardLayout();
		const outerW = width + 34;
		const outerH = height + 34;
		const left = x - outerW * 0.5;
		const top = y - outerH * 0.5;

		g.roundRect(left - 10, top - 10, outerW + 20, outerH + 20, 28);
		g.fill({ color: 0x00142f, alpha: glowShow ? 0.72 : 0.5 });
		g.stroke({ color: glowShow ? 0x4dbdff : 0x102d4c, width: glowShow ? 6 : 3, alpha: 0.55 });

		g.roundRect(left, top, outerW, outerH, 24);
		g.fill({ color: 0x020816, alpha: 0.82 });
		g.stroke({ color: 0xf3c64c, width: 6, alpha: 0.95 });

		g.roundRect(x - width * 0.5 - 4, y - height * 0.5 - 4, width + 8, height + 8, 16);
		g.stroke({ color: 0xffffff, width: 1, alpha: 0.2 });
	}}
/>
