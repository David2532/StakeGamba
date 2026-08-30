// @ts-ignore -- shared workspace config is JavaScript by design.
import config from 'config-svelte';

// @ts-ignore -- the shared package exports a factory, but its package boundary exposes Config.
export default config();
