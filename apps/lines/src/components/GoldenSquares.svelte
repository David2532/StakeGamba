<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventGoldenSquares =
		| { type: 'goldenSquaresShow'; positions: Position[] }
		| { type: 'goldenSquaresHide' };
</script>

<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { REEL_PADDING, SYMBOL_SIZE } from '../game/constants';

	const context = getContext();
	let positions = $state<Position[]>([]);

	context.eventEmitter.subscribeOnMount({
		goldenSquaresShow: (event) => (positions = event.positions),
		goldenSquaresHide: () => (positions = []),
	});
</script>

<Graphics
	draw={(g) => {
		const offsetX = SYMBOL_SIZE * (REEL_PADDING - 0.5);

		for (const position of positions) {
			const x = offsetX + position.reel * SYMBOL_SIZE;
			const y = position.row * SYMBOL_SIZE;

			g.roundRect(x + 4, y + 4, SYMBOL_SIZE - 8, SYMBOL_SIZE - 8, 14);
			g.fill({ color: 0xffc83d, alpha: 0.46 });
			g.stroke({ color: 0xfff0a8, width: 4, alpha: 0.92 });

			g.roundRect(x + 14, y + 14, SYMBOL_SIZE - 28, SYMBOL_SIZE - 28, 10);
			g.stroke({ color: 0xffffff, width: 2, alpha: 0.38 });
		}
	}}
/>
