<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Container } from 'pixi-svelte';

	type Props = {
		x: number;
		y: number;
		hovered: boolean;
		pressed: boolean;
		children: Snippet;
	};

	const props: Props = $props();
	const scaleTween = new Tween(1, { duration: 120, easing: cubicOut });

	$effect(() => {
		scaleTween.set(props.pressed ? 0.92 : props.hovered ? 1.05 : 1);
	});
</script>

<Container x={props.x} y={props.y} scale={scaleTween.current}>
	{@render props.children()}
</Container>
