<script lang="ts">
	import SymbolSprite from './SymbolSprite.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { BitmapText } from 'pixi-svelte';
	import { INITIAL_BOARD } from '../game/constants';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		oncomplete?: () => void;
		loop?: boolean;
	};

	const props: Props = $props();
	const rawSymbol = $derived(props.rawSymbol ?? INITIAL_BOARD[0][0]);
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol, state: props.state }));
</script>

<SymbolSprite {symbolInfo} x={props.x} y={props.y} oncomplete={props.oncomplete} />

{#if rawSymbol.multiplier && rawSymbol.name !== 'W'}
	<BitmapText
		anchor={0.5}
		x={props.x}
		y={props.y}
		text={`${rawSymbol.multiplier}X`}
		style={{
			fontFamily: 'gold',
			fontSize: 50,
		}}
	/>
{/if}
