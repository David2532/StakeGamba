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
		width: SYMBOL_SIZE * BOARD_DIMENSIONS.x * 1.18,
		height: SYMBOL_SIZE * BOARD_DIMENSIONS.y * 0.86,
	};
</script>

<MainContainer>
	<Container x={context.stateGameDerived.boardLayout().x} y={context.stateGameDerived.boardLayout().y}>
		<Graphics
			draw={(g) => {
				const { width, height } = PANEL_SIZES;
				const x = -width * 0.5;
				const y = -height * 0.5;

				g.roundRect(x - 10, y - 10, width + 20, height + 20, 30);
				g.fill({ color: 0x00142e, alpha: 0.72 });
				g.stroke({ color: 0xf2c64c, width: 7, alpha: 0.94 });

				g.roundRect(x, y, width, height, 24);
				g.fill({ color: 0x03162f, alpha: 0.88 });
				g.stroke({ color: 0xffffff, width: 1, alpha: 0.2 });

				g.rect(x, y + height * 0.66, width, height * 0.34);
				g.fill({ color: 0x0a5f21, alpha: 0.32 });

				g.circle(0, y + height * 0.68, width * 0.16);
				g.stroke({ color: 0xffffff, width: 3, alpha: 0.28 });
			}}
		/>

		{@render props.children({ sizes: PANEL_SIZES })}
	</Container>
</MainContainer>
