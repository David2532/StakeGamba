<script lang="ts">
	import { Graphics } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import type { WinLevelAlias } from '../game/winLevelMap';

	type Props = {
		emit?: boolean;
		levelAlias?: WinLevelAlias;
	};

	const props: Props = $props();
	const context = getContext();
	const particleCount = $derived(props.levelAlias === 'max' ? 44 : props.levelAlias === 'mega' ? 32 : 22);
</script>

{#if props.emit}
	<MainContainer>
		<Graphics
			zIndex={80}
			draw={(g) => {
				const { width, height } = context.stateLayoutDerived.mainLayout();
				const centerX = context.stateGameDerived.boardLayout().x;
				const centerY = context.stateGameDerived.boardLayout().y;

				for (let i = 0; i < particleCount; i++) {
					const side = i % 2 === 0 ? -1 : 1;
					const arc = (i / particleCount) * Math.PI;
					const x = centerX + side * (width * 0.12 + Math.sin(arc) * width * 0.32);
					const y = centerY - height * 0.34 + ((i * 37) % 180);
					const w = 10 + (i % 4) * 5;
					const h = 6 + (i % 3) * 4;
					const color = [0xffd447, 0x47b9ff, 0xffffff, 0x12a84a][i % 4];

					g.roundRect(x, y, w, h, 2);
					g.fill({ color, alpha: 0.72 });
				}
			}}
		/>
	</MainContainer>
{/if}
