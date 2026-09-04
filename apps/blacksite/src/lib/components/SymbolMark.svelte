<script>
	import { symbolSpriteHref } from '../assets/symbol-art.js';

	export let symbol;

	$: spriteHref = symbolSpriteHref(symbol);
</script>

<svg
	class="symbol-art"
	data-symbol-art={symbol}
	viewBox="0 0 64 64"
	preserveAspectRatio="xMidYMid meet"
	aria-hidden="true"
	focusable="false"
>
	<use href={spriteHref}></use>
</svg>

<style>
	.symbol-art {
		position: relative;
		z-index: 1;
		display: block;
		width: min(68%, 42px);
		height: auto;
		aspect-ratio: 1;
		overflow: visible;
		color: var(--symbol-color, #a8c2c7);
		filter: drop-shadow(0 0 7px color-mix(in srgb, currentColor 34%, transparent));
	}

	@media (max-width: 820px), (max-height: 560px) {
		.symbol-art {
			width: min(76%, 38px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.symbol-art {
			filter: none;
		}
	}
</style>
