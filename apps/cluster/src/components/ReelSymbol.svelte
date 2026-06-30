<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { stateGameDerived, type ReelSymbol } from '../game/stateGame.svelte';

	// How much non-winning symbols are dimmed while a win is highlighted.
	const DIM_ALPHA = 0.35;

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);
	const isWinningSymbol = $derived(
		props.reelSymbol.symbolState === 'win' || props.reelSymbol.symbolState === 'postWinStatic',
	);
	// Dim this symbol only while some *other* symbol on the board is winning.
	const dimmed = $derived(!isWinningSymbol && stateGameDerived.hasWinningSymbols());
</script>

<SymbolWrap
	x={getSymbolX(props.reelIndex)}
	y={props.reelSymbol.symbolY.current}
	alpha={dimmed ? DIM_ALPHA : 1}
	animating={symbolInfo.type === 'spine' &&
		(props.reelSymbol.symbolState === 'land' || props.reelSymbol.symbolState === 'win')}
>
	<Symbol
		state={props.reelSymbol.symbolState}
		rawSymbol={props.reelSymbol.rawSymbol}
		oncomplete={() => {
			if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
			if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
		}}
	/>
</SymbolWrap>
