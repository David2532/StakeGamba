<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventClusterHighlight =
		| { type: 'clusterHighlightShow'; positions: Position[] }
		| { type: 'clusterHighlightHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';

	import { Graphics } from 'pixi-svelte';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';

	// Cluster-style win highlight: a pulsing golden frame + glow drawn directly
	// around each winning cell. Deliberately NOT a payline — every winning
	// position is marked individually so wins are obvious on a cluster board.
	const GOLD = 0xffd23f;
	const PULSE_DURATION = 450;

	const context = getContext();

	let positions = $state<Position[]>([]);
	const pulse = new Tween(0);
	let running = false;

	const runPulse = async () => {
		if (running) return;
		running = true;
		while (running && positions.length > 0) {
			await pulse.set(1, { duration: PULSE_DURATION });
			await pulse.set(0, { duration: PULSE_DURATION });
		}
		running = false;
	};

	const cellCenter = (position: Position) => ({
		x: SYMBOL_SIZE * (position.reel + 0.5),
		y: SYMBOL_SIZE * (position.row - 0.5),
	});

	context.eventEmitter.subscribeOnMount({
		clusterHighlightShow: ({ positions: nextPositions }) => {
			positions = nextPositions ?? [];
			runPulse();
		},
		clusterHighlightHide: () => {
			positions = [];
			running = false;
			pulse.set(0, { duration: 0 });
		},
	});
</script>

{#if positions.length > 0}
	<!-- read pulse.current here so the template re-renders each animation frame
	     and the Graphics `draw` closure re-runs (drives the pulse) -->
	{@const p = pulse.current}
	<BoardContainer>
		<Graphics
			draw={(graphics) => {
				graphics.clear();
				const inset = SYMBOL_SIZE * (0.47 - 0.03 * p);
				const size = inset * 2;
				const radius = SYMBOL_SIZE * 0.18;

				// soft outer glow
				positions.forEach((position) => {
					const { x, y } = cellCenter(position);
					graphics.roundRect(x - inset, y - inset, size, size, radius);
				});
				graphics.stroke({ width: 10 + 8 * p, color: GOLD, alpha: 0.12 + 0.2 * p });

				// strong golden border
				positions.forEach((position) => {
					const { x, y } = cellCenter(position);
					graphics.roundRect(x - inset, y - inset, size, size, radius);
				});
				graphics.stroke({ width: 3 + 3 * p, color: GOLD, alpha: 0.95 });
			}}
		/>
	</BoardContainer>
{/if}
