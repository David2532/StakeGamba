<script lang="ts" module>
	import type { Position } from '../game/types';

	export type EmitterEventWinLines =
		| { type: 'winLineShow'; positions: Position[]; lineIndex?: number }
		| { type: 'winLineHide' };
</script>

<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { SYMBOL_SIZE } from '../game/constants';

	const context = getContext();

	let show = $state(false);
	let positions = $state<Position[]>([]);
	let lineIndex = $state<number | undefined>();

	const sortedPositions = $derived([...positions].sort((a, b) => a.reel - b.reel));

	context.eventEmitter.subscribeOnMount({
		winLineShow: (event) => {
			positions = event.positions;
			lineIndex = event.lineIndex;
			show = positions.length > 1;
		},
		winLineHide: () => {
			show = false;
			positions = [];
			lineIndex = undefined;
		},
	});
</script>

<BoardContainer>
	<Graphics
		zIndex={30}
		draw={(g) => {
			if (!show || sortedPositions.length < 2) return;

			const points = sortedPositions.map((position) => ({
				x: getSymbolX(position.reel),
				y: getSymbolY(position.row),
			}));

			const color = lineIndex !== undefined && lineIndex % 2 === 1 ? 0x47b9ff : 0xffd447;

			g.moveTo(points[0].x, points[0].y);
			for (const point of points.slice(1)) {
				g.lineTo(point.x, point.y);
			}
			g.stroke({ color: 0x001d3a, width: SYMBOL_SIZE * 0.18, alpha: 0.72 });

			g.moveTo(points[0].x, points[0].y);
			for (const point of points.slice(1)) {
				g.lineTo(point.x, point.y);
			}
			g.stroke({ color, width: SYMBOL_SIZE * 0.105, alpha: 0.95 });

			g.moveTo(points[0].x, points[0].y);
			for (const point of points.slice(1)) {
				g.lineTo(point.x, point.y);
			}
			g.stroke({ color: 0xffffff, width: SYMBOL_SIZE * 0.032, alpha: 0.92 });

			for (const point of points) {
				g.circle(point.x, point.y, SYMBOL_SIZE * 0.18);
				g.fill({ color, alpha: 0.28 });
				g.circle(point.x, point.y, SYMBOL_SIZE * 0.115);
				g.stroke({ color: 0xffffff, width: SYMBOL_SIZE * 0.025, alpha: 0.95 });
			}
		}}
	/>
</BoardContainer>
