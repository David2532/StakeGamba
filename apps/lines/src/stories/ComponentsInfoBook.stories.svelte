<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import InfoBook from '../components/InfoBook.svelte';

	const { Story } = defineMeta({
		title: 'Components/<InfoBook>',
		component: InfoBook,
	});
</script>

<script lang="ts">
	import { stateModal } from 'state-shared';

	const open = () => (stateModal.modal = { name: 'payTable' });
</script>

<Story name="component">
	{#snippet template()}
		<button style="margin: 1rem; padding: 0.5rem 1rem;" onclick={open}>Open InfoBook</button>
		<InfoBook />
	{/snippet}
</Story>
