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

<Rectangle {...canvasSizes} backgroundColor={0x030306} zIndex={-5} />

<FadeContainer show={showBaseBackground} duration={SECOND} zIndex={-4}>
	<Graphics
		draw={(graphics) => {
			const { width, height } = canvasSizes;

			graphics.rect(0, 0, width, height);
			graphics.fill({ color: 0x05060c });

			graphics.rect(0, height * 0.58, width, height * 0.42);
			graphics.fill({ color: 0x070407, alpha: 0.95 });

			graphics.rect(0, height * 0.5, width, height * 0.08);
			graphics.fill({ color: 0x8c1223, alpha: 0.36 });

			graphics.rect(0, height * 0.555, width, 5);
			graphics.fill({ color: 0xe0aa3a, alpha: 0.72 });

			for (let i = 0; i < 18; i += 1) {
				const x = (width / 17) * i;
				graphics.rect(x - 2, height * 0.2, 4, height * 0.36);
				graphics.fill({ color: 0x1d1b24, alpha: 0.7 });
			}

			for (let i = 0; i < 7; i += 1) {
				const x = width * 0.14 + i * width * 0.12;
				graphics.rect(x - width * 0.045, height * 0.12, width * 0.09, 12);
				graphics.fill({ color: 0xffe49a, alpha: 0.45 });
			}

			graphics.rect(width * 0.08, height * 0.7, width * 0.84, 4);
			graphics.fill({ color: 0xffffff, alpha: 0.14 });

			graphics.rect(width * 0.2, height * 0.78, width * 0.6, 3);
			graphics.fill({ color: 0xffffff, alpha: 0.12 });
		}}
	/>
</FadeContainer>

<FadeContainer show={showFeatureBackground} duration={SECOND} zIndex={-3}>
	<Graphics
		draw={(graphics) => {
			const { width, height } = canvasSizes;

			graphics.rect(0, 0, width, height);
			graphics.fill({ color: 0x12040a, alpha: 0.72 });

			graphics.rect(0, height * 0.53, width, height * 0.1);
			graphics.fill({ color: 0xd5a038, alpha: 0.28 });

			graphics.rect(0, height * 0.63, width, 7);
			graphics.fill({ color: 0xc5192e, alpha: 0.72 });
		}}
	/>
</FadeContainer>
