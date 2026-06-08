<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container, Graphics, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		animationMap: Record<string, string>;
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();
	const width = $derived(context.stateGameDerived.boardLayout().width * 1.35);
	const height = $derived(context.stateGameDerived.boardLayout().height * 0.72);
</script>

<Container>
	<Graphics
		draw={(g) => {
			const x = -width * 0.5;
			const y = -height * 0.5;

			g.roundRect(x, y, width, height, 30);
			g.fill({ color: 0x03162f, alpha: 0.82 });
			g.stroke({ color: 0xffd447, width: 9, alpha: 0.95 });

			g.roundRect(x + 14, y + 14, width - 28, height - 28, 22);
			g.stroke({ color: 0xffffff, width: 2, alpha: 0.38 });

			for (let i = 0; i < 7; i++) {
				const px = x + width * (0.12 + i * 0.13);
				g.circle(px, y + height * 0.18, 6);
				g.fill({ color: i % 2 ? 0x47b9ff : 0xffd447, alpha: 0.8 });
			}
		}}
	/>
	<Text
		anchor={0.5}
		y={-height * 0.22}
		text={props.animationMap?.intro?.includes('max') ? 'WORLD CUP WIN' : 'GOAL!'}
		style={{
			fontFamily: 'proxima-nova',
			fontSize: width * 0.09,
			fontWeight: '900',
			fill: 0xffd447,
			align: 'center',
		}}
	/>
	<Container y={height * 0.12}>
		{@render props.children()}
	</Container>
</Container>
