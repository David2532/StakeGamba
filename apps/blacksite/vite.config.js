import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	plugins: [sveltekit()],
	define: {
		__BLACKSITE_DEV_FIXTURES__: JSON.stringify(command === 'serve'),
	},
	build: {
		assetsInlineLimit: Infinity,
		sourcemap: false,
	},
}));
