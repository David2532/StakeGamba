<script lang="ts">
	import { Graphics, Rectangle } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { SECOND } from 'constants-shared/time';

	import { getContext } from '../game/context';

	const context = getContext();
	const showBaseBackground = $derived(context.stateGame.gameType === 'basegame');
	const showFeatureBackground = $derived(context.stateGame.gameType === 'freegame');
	const canvasSizes = $derived(context.stateLayoutDerived.canvasSizes());
</script>

<Rectangle {...canvasSizes} backgroundColor={0x020305} zIndex={-5} />

<FadeContainer show={showBaseBackground} duration={SECOND} zIndex={-4}>
	<Graphics
		draw={(graphics) => {
			const { width, height } = canvasSizes;
			const cx = width * 0.5;
			const boardY = height * 0.44;

			// Deep stadium base — near-black with cold blue tint
			graphics.rect(0, 0, width, height);
			graphics.fill({ color: 0x03040a });

			// Upper stadium stand — dark maroon rows (crowd area)
			for (let row = 0; row < 14; row++) {
				const y = height * 0.04 + row * height * 0.038;
				const alpha = 0.08 + row * 0.012;
				const shade = row % 2 === 0 ? 0x1a0810 : 0x120608;
				graphics.rect(0, y, width, height * 0.036);
				graphics.fill({ color: shade, alpha: Math.min(alpha, 0.28) });
			}

			// Vertical stadium column shadows (structural pillars)
			for (let i = 0; i < 20; i++) {
				const x = (width / 19) * i;
				graphics.rect(x - 3, height * 0.04, 6, height * 0.52);
				graphics.fill({ color: 0x0d0b14, alpha: 0.55 });
			}

			// Stadium flood-light halo — two cones from upper corners
			graphics.moveTo(cx - width * 0.52, 0);
			graphics.lineTo(cx - width * 0.08, height * 0.5);
			graphics.lineTo(cx - width * 0.38, height * 0.5);
			graphics.lineTo(cx - width * 0.72, 0);
			graphics.fill({ color: 0xfff4c2, alpha: 0.022 });

			graphics.moveTo(cx + width * 0.52, 0);
			graphics.lineTo(cx + width * 0.08, height * 0.5);
			graphics.lineTo(cx + width * 0.38, height * 0.5);
			graphics.lineTo(cx + width * 0.72, 0);
			graphics.fill({ color: 0xfff4c2, alpha: 0.022 });

			// Central spotlight wash — warm amber on the board area
			for (let r = 6; r >= 1; r--) {
				const rw = width * 0.18 * r;
				const rh = height * 0.22 * r;
				graphics.ellipse(cx, boardY, rw, rh);
				graphics.fill({ color: 0xd4870e, alpha: 0.013 });
			}

			// Crowd seat rows in upper area — warm cream highlights
			for (let i = 0; i < 9; i++) {
				const x = width * 0.08 + i * width * 0.105;
				graphics.rect(x, height * 0.07, width * 0.075, 8);
				graphics.fill({ color: 0xffd580, alpha: 0.28 });
				graphics.rect(x, height * 0.115, width * 0.075, 5);
				graphics.fill({ color: 0xe8c06a, alpha: 0.18 });
			}

			// Mid-pitch dividing zone — subtle red/gold gradient band
			graphics.rect(0, height * 0.5, width, height * 0.07);
			graphics.fill({ color: 0x8c1223, alpha: 0.22 });

			// Gold accent stripe at bottom of stand zone
			graphics.rect(0, height * 0.56, width, 4);
			graphics.fill({ color: 0xe8b84a, alpha: 0.68 });

			// Green pitch hint at the very bottom
			graphics.rect(0, height * 0.82, width, height * 0.18);
			graphics.fill({ color: 0x062208, alpha: 0.72 });

			// Pitch centre circle hint
			graphics.ellipse(cx, height * 0.92, width * 0.12, height * 0.05);
			graphics.stroke({ color: 0x0e4a18, width: 3, alpha: 0.55 });

			// Pitch goal-line markers
			graphics.rect(width * 0.08, height * 0.84, width * 0.84, 2);
			graphics.fill({ color: 0x0e4a18, alpha: 0.45 });
			graphics.rect(width * 0.18, height * 0.88, width * 0.64, 2);
			graphics.fill({ color: 0x0e4a18, alpha: 0.32 });

			// Vignette — darken all four corners to focus eye on board
			const vSize = width * 0.38;
			graphics.rect(0, 0, vSize, height);
			graphics.fill({ color: 0x000000, alpha: 0.38 });
			graphics.rect(width - vSize, 0, vSize, height);
			graphics.fill({ color: 0x000000, alpha: 0.38 });
			graphics.rect(0, 0, width, height * 0.12);
			graphics.fill({ color: 0x000000, alpha: 0.45 });
			graphics.rect(0, height * 0.88, width, height * 0.12);
			graphics.fill({ color: 0x000000, alpha: 0.28 });
		}}
	/>
</FadeContainer>

<FadeContainer show={showFeatureBackground} duration={SECOND} zIndex={-3}>
	<Graphics
		draw={(graphics) => {
			const { width, height } = canvasSizes;
			const cx = width * 0.5;

			graphics.rect(0, 0, width, height);
			graphics.fill({ color: 0x0d020a, alpha: 0.78 });

			// Feature mode: deep crimson atmosphere
			for (let r = 5; r >= 1; r--) {
				graphics.ellipse(cx, height * 0.42, width * 0.22 * r, height * 0.24 * r);
				graphics.fill({ color: 0xb5122e, alpha: 0.028 });
			}

			graphics.rect(0, height * 0.52, width, height * 0.1);
			graphics.fill({ color: 0xd5a038, alpha: 0.22 });

			graphics.rect(0, height * 0.62, width, 6);
			graphics.fill({ color: 0xc5192e, alpha: 0.78 });

			// Vignette
			graphics.rect(0, 0, width * 0.35, height);
			graphics.fill({ color: 0x000000, alpha: 0.42 });
			graphics.rect(width * 0.65, 0, width * 0.35, height);
			graphics.fill({ color: 0x000000, alpha: 0.42 });
		}}
	/>
</FadeContainer>
