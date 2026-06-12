<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Container, Text } from 'pixi-svelte';
	import { WHITE } from 'constants-shared/colors';

	import UiSprite from './UiSprite.svelte';
	import { UI_BASE_FONT_SIZE } from '../constants';

	type Props = {
		label: string;
		value: string;
		tiled?: boolean;
		stacked?: boolean;
		tileColor?: number;
	};

	const props: Props = $props();

	const labelStyle = {
		fontFamily: 'proxima-nova',
		fontSize: UI_BASE_FONT_SIZE,
		fill: 0xf4d276,
		fontWeight: '700',
	} as const;

	const valueStyle = {
		fontFamily: 'proxima-nova',
		fontSize: UI_BASE_FONT_SIZE,
		fill: WHITE,
		fontWeight: '700',
	} as const;

	// Pulse the value when it changes (skipping the initial render), so balance,
	// bet and win updates give visible feedback even for small amounts.
	const pulseTween = new Tween(1, { duration: 130, easing: cubicOut });
	let lastValue = props.value;
	let pulsing = false;
	$effect(() => {
		if (props.value === lastValue) return;
		lastValue = props.value;
		if (pulsing) return;
		pulsing = true;
		pulseTween
			.set(1.12)
			.then(() => pulseTween.set(1))
			.then(() => {
				pulsing = false;
			});
	});
</script>

{#if props.stacked}
	{#if props.tiled}
		<UiSprite
			y={-20}
			anchor={{ x: 0.5, y: 0 }}
			key="base_ticker"
			width={UI_BASE_FONT_SIZE * 3 * (326 / 73)}
			height={UI_BASE_FONT_SIZE * 3}
			borderRadius={35}
			{...props.tileColor !== undefined ? { backgroundColor: props.tileColor } : {}}
		/>
	{/if}
	<Text anchor={{ x: 0.5, y: 0 }} text={props.label} style={labelStyle} />
	<Container y={UI_BASE_FONT_SIZE * 1.5} scale={pulseTween.current}>
		<Text anchor={{ x: 0.5, y: 0.5 }} text={props.value} style={valueStyle} />
	</Container>
{:else}
	{#if props.tiled}
		<UiSprite
			x={-90}
			anchor={{ x: 0, y: 0.5 }}
			key="base_ticker"
			width={UI_BASE_FONT_SIZE * 3 * (326 / 73)}
			height={UI_BASE_FONT_SIZE * 3}
			borderRadius={35}
		/>
	{/if}
	<Text anchor={{ x: 0, y: 0.5 }} text={props.label} style={labelStyle} />
	<Container x={UI_BASE_FONT_SIZE * 10} scale={pulseTween.current}>
		<Text anchor={{ x: 1, y: 0.5 }} text={props.value} style={valueStyle} />
	</Container>
{/if}
