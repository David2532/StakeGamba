<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { LoaderStakeEngine, LoaderExample } from 'components-shared';
	import GoldenGoalRushFinalPreview from '../components/GoldenGoalRushFinalPreview.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();

	let showYourLoader = $state(false);

	const loaderUrlStakeEngine = new URL('../../stake-engine-loader.gif', import.meta.url).href;
	const loaderUrl = new URL('../../loader.gif', import.meta.url).href;
</script>

<GlobalStyle>
	<GoldenGoalRushFinalPreview />
</GlobalStyle>

<LoaderStakeEngine src={loaderUrlStakeEngine} oncomplete={() => (showYourLoader = true)} />

{#if showYourLoader}
	<LoaderExample src={loaderUrl} />
	<!-- '/loader.gif' is served from static folder of sveltekit -->
	<!-- File location: apps/cluster/static/loader.gif -->
{/if}

{@render props.children()}
