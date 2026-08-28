// @ts-ignore -- shared workspace config is JavaScript by design.
import config from 'config-svelte';

const sharedConfig = config();

export default {
	...sharedConfig,
	kit: {
		...sharedConfig.kit,
		// SvelteKit otherwise embeds Date.now() into every production bundle, which
		// makes byte-identical BLACKSITE sources produce a different Stake upload.
		version: { name: 'blacksite-0.3.0-v3' },
	},
};
