import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { blacksiteDevMathRoundPlugin } from './vite/dev-math-round-plugin.mjs';

export default defineConfig(({ command }) => ({
	plugins: [blacksiteDevMathRoundPlugin(), sveltekit()],
	define: {
		__BLACKSITE_DEV_FIXTURES__: JSON.stringify(command === 'serve'),
		// Presentation promotion is a build concern, independent from fixture
		// authority. Production gets the approved responsive shell/UI stack while
		// fixture routes and DEV characters remain compile-time disabled.
		__BLACKSITE_MODERN_PRESENTATION__: JSON.stringify(true),
	},
	build: {
		assetsInlineLimit: Infinity,
		sourcemap: false,
	},
}));
