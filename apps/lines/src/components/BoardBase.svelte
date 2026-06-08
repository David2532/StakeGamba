<script lang="ts">
	import ReelSymbol from './ReelSymbol.svelte';
	import ReelGrid from './ReelGrid.svelte';
	import { getContext } from '../game/context';

	const context = getContext();
</script>

<ReelGrid />

{#each context.stateGame.board as reel, reelIndex (reelIndex)}
	{#each reel.reelState.symbols as reelSymbol}
		<ReelSymbol {reelIndex} {reelSymbol} />
	{/each}
{/each}
