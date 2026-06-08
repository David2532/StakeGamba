<script lang="ts">
	import { Graphics } from 'pixi-svelte';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS, REEL_PADDING } from '../game/constants';
</script>

<Graphics
	draw={(g) => {
		const cols = BOARD_DIMENSIONS.x;
		const rows = BOARD_DIMENSIONS.y;
		const w = SYMBOL_SIZE * cols;
		const h = SYMBOL_SIZE * rows;
		const offsetX = SYMBOL_SIZE * (REEL_PADDING - 0.5);

		g.roundRect(offsetX, 0, w, h, 14);
		g.fill({ color: 0x020512, alpha: 0.52 });

		for (let r = 0; r < rows; r++) {
			const y = r * SYMBOL_SIZE;
			g.rect(offsetX, y, w, SYMBOL_SIZE - 1);
			g.fill({ color: r % 2 ? 0x06142a : 0x031022, alpha: 0.14 });
		}

		for (let c = 0; c < cols; c++) {
			const x = offsetX + c * SYMBOL_SIZE;
			g.rect(x, 0, SYMBOL_SIZE - 1, h);
			g.fill({ color: c % 2 ? 0xffffff : 0x000000, alpha: c % 2 ? 0.015 : 0.025 });
		}

		for (let r = 1; r < rows; r++) {
			const y = r * SYMBOL_SIZE;
			g.rect(offsetX, y - 1, w, 2);
			g.fill({ color: 0xf2c64c, alpha: 0.16 });
		}

		for (let c = 1; c < cols; c++) {
			const x = offsetX + c * SYMBOL_SIZE;
			g.rect(x - 1, 0, 2, h);
			g.fill({ color: 0xf2c64c, alpha: 0.2 });
		}

		g.roundRect(offsetX, 0, w, h, 14);
		g.stroke({ color: 0xf2c64c, width: 3, alpha: 0.42 });
	}}
/>
