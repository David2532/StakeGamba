<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import type { Reel } from '../game/stateGame.svelte';
	import { REEL_PADDING, SYMBOL_SIZE } from '../game/constants';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') {
			props.oncomplete();
		}
	});
</script>

<Graphics
	x={context.stateGameDerived.boardLayout().x -
		context.stateGameDerived.boardLayout().width * 0.5 +
		(props.reel.reelIndex + REEL_PADDING) * SYMBOL_SIZE}
	y={context.stateGameDerived.boardLayout().y}
	draw={(g) => {
		g.roundRect(-SYMBOL_SIZE * 0.48, -SYMBOL_SIZE * 1.45, SYMBOL_SIZE * 0.96, SYMBOL_SIZE * 2.9, 18);
		g.stroke({ color: 0xffd447, width: 7, alpha: 0.9 });
		g.roundRect(-SYMBOL_SIZE * 0.4, -SYMBOL_SIZE * 1.35, SYMBOL_SIZE * 0.8, SYMBOL_SIZE * 2.7, 14);
		g.stroke({ color: 0x47b9ff, width: 3, alpha: 0.78 });
		g.circle(0, -SYMBOL_SIZE * 1.62, SYMBOL_SIZE * 0.13);
		g.fill({ color: 0xffffff, alpha: 0.86 });
	}}
/>
