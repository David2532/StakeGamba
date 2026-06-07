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

		// Alternating column tint (every 2nd reel slightly lighter)
		for (let c = 0; c < cols; c++) {
			if (c % 2 === 0) {
				const x = offsetX + c * SYMBOL_SIZE;
				g.rect(x, 0, SYMBOL_SIZE, h);
				g.fill({ color: 0x0a0810, alpha: 0.45 });
			}
		}

		// Horizontal row dividers — thin, very subtle
		for (let r = 1; r < rows; r++) {
			const y = r * SYMBOL_SIZE;
			g.rect(offsetX, y - 1, w, 2);
			g.fill({ color: 0x1a1520, alpha: 0.55 });
		}

		// Vertical column separators — thin gold-tinted lines
		for (let c = 1; c < cols; c++) {
			const x = offsetX + c * SYMBOL_SIZE;
			g.rect(x - 1, 0, 2, h);
			g.fill({ color: 0xc89a30, alpha: 0.18 });
		}

		// Top edge shadow (gradient-like using multiple rects)
		for (let i = 0; i < 6; i++) {
			g.rect(offsetX, i * 4, w, 4);
			g.fill({ color: 0x000000, alpha: 0.06 - i * 0.008 });
		}

		// Bottom edge shadow
		for (let i = 0; i < 6; i++) {
			g.rect(offsetX, h - (i + 1) * 4, w, 4);
			g.fill({ color: 0x000000, alpha: 0.06 - i * 0.008 });
		}
	}}
/>
