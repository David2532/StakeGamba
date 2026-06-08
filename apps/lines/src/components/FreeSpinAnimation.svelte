<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container, Graphics, type Sizes } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, BOARD_DIMENSIONS } from '../game/constants';

	type Props = {
		children: Snippet<[{ sizes: Sizes }]>;
	};

	const props: Props = $props();
	const context = getContext();
	const PANEL_SIZES = {
		width: SYMBOL_SIZE * BOARD_DIMENSIONS.x * 1.38,
		height: SYMBOL_SIZE * BOARD_DIMENSIONS.y * 1.08,
	};
</script>

<MainContainer>
	<Container x={context.stateGameDerived.boardLayout().x} y={context.stateGameDerived.boardLayout().y}>
		<Graphics
			draw={(g) => {
				const { width, height } = PANEL_SIZES;
				const x = -width * 0.5;
				const y = -height * 0.5;

				g.roundRect(x, y, width, height, 34);
				g.fill({ color: 0x03162f, alpha: 0.9 });
				g.stroke({ color: 0xf4c64d, width: 10, alpha: 0.95 });

				g.roundRect(x + 18, y + 18, width - 36, height - 36, 24);
				g.stroke({ color: 0xffffff, width: 2, alpha: 0.35 });

				g.rect(x, y + height * 0.68, width, height * 0.32);
				g.fill({ color: 0x0a661f, alpha: 0.35 });

				for (let i = 0; i < 9; i++) {
					const px = x + width * (0.08 + i * 0.105);
					g.circle(px, y + height * 0.18, 5 + (i % 3) * 2);
					g.fill({ color: i % 2 ? 0x47b9ff : 0xffd447, alpha: 0.82 });
				}

				g.circle(0, y + height * 0.72, width * 0.22);
				g.stroke({ color: 0xffffff, width: 3, alpha: 0.35 });

				g.rect(-width * 0.34, y + height * 0.72, width * 0.68, 3);
				g.fill({ color: 0xffffff, alpha: 0.35 });
			}}
		/>

		{@render props.children({ sizes: PANEL_SIZES })}
	</Container>
</MainContainer>
