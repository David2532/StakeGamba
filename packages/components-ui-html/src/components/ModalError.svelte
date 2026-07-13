<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';

	const formatError = (value: unknown) => {
		if (value instanceof Error) return `${value.name}: ${value.message}`;
		if (typeof value === 'string') return value;
		if (value === null || value === undefined) return 'unknown error';
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	};
</script>

{#if stateModal.modal?.name === 'error'}
	<Popup zIndex={zIndex.modal} persistent onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			<span>Sorry, something went wrong.</span>
			<div class="scrollY error-text">
				<p>{formatError(stateModal.modal.error)}</p>
			</div>
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	.error-text {
		max-height: 100px;
		max-width: 480px;
		border-radius: 8px;
		border: 1px solid red;
		white-space: normal;
		padding: 1rem;
	}
</style>
