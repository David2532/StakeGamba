<script lang="ts">
	import { Graphics } from 'pixi-svelte';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS, REEL_PADDING } from '../game/constants';
</script>

<!--
  Visual-only reel grid: column separators + subtle per-row tint.
  Renders behind symbols inside BoardContainer.
-->
<Graphics
	draw={(g) => {
		const cols = BOARD_DIMENSIONS.x;
		const rows = BOARD_DIMENSIONS.y;
		const w = SYMBOL_SIZE * cols;
		const h = SYMBOL_SIZE * rows;
		const offsetX = -SYMBOL_SIZE * REEL_PADDING;

		// Row lighting gradient — top row slightly illuminated, bottom dimmer
		// Simulates flood-light coming from above
		const rowLightAlphas = [0.0, 0.06, 0.14]; // row 0 = brightest (top)
		for (let r = 0; r < rows; r++) {
			const y = r * SYMBOL_SIZE;
			g.rect(offsetX, y, w, SYMBOL_SIZE);
			g.fill({ color: 0x000000, alpha: rowLightAlphas[r] });
		}

		// Alternating column tint — even columns very slightly darker
		for (let c = 0; c < cols; c++) {
			if (c % 2 === 0) {
				const x = offsetX + c * SYMBOL_SIZE;
				g.rect(x, 0, SYMBOL_SIZE, h);
				g.fill({ color: 0x000000, alpha: 0.10 });
			}
		}

		// Horizontal row dividers — warm dark
		for (let r = 1; r < rows; r++) {
			const y = r * SYMBOL_SIZE;
			g.rect(offsetX, y - 1, w, 2);
			g.fill({ color: 0x2a1428, alpha: 0.6 });
		}

		// Vertical column separators — gold-tinted
		for (let c = 1; c < cols; c++) {
			const x = offsetX + c * SYMBOL_SIZE;
			g.rect(x - 1, 0, 2, h);
			g.fill({ color: 0xd4a030, alpha: 0.24 });
		}

		// Top-edge warm light bleed — subtle gold from frame above
		for (let i = 0; i < 5; i++) {
			g.rect(offsetX, i * 3, w, 3);
			g.fill({ color: 0xd4a030, alpha: 0.028 - i * 0.004 });
		}

		// Bottom-edge shadow fade
		for (let i = 0; i < 6; i++) {
			g.rect(offsetX, h - (i + 1) * 4, w, 4);
			g.fill({ color: 0x000000, alpha: 0.05 - i * 0.007 });
		}
	}}
/>
