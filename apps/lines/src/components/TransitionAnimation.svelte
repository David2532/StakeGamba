<script lang="ts">
	import { onMount } from 'svelte';
	import { Graphics, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		oncomplete: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	onMount(() => {
		const timeout = window.setTimeout(props.oncomplete, 650);
		return () => window.clearTimeout(timeout);
	});
</script>

<Graphics
	draw={(g) => {
		const { width, height } = context.stateLayoutDerived.canvasSizes();
		g.rect(0, 0, width, height);
		g.fill({ color: 0x00122b, alpha: 0.86 });

		g.rect(0, height * 0.46, width, height * 0.08);
		g.fill({ color: 0x0a661f, alpha: 0.75 });

		g.circle(width * 0.5, height * 0.5, height * 0.22);
		g.stroke({ color: 0xffffff, width: 4, alpha: 0.55 });
	}}
/>
<Text
	anchor={0.5}
	x={context.stateLayoutDerived.canvasSizes().width * 0.5}
	y={context.stateLayoutDerived.canvasSizes().height * 0.5}
	text="KICK OFF"
	style={{
		fontFamily: 'proxima-nova',
		fontSize: context.stateLayoutDerived.canvasSizes().height * 0.075,
		fontWeight: '900',
		fill: 0xffd447,
		align: 'center',
	}}
/>
