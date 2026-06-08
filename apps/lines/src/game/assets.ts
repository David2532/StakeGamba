export default {
	'ggr-l1': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-l1.png', import.meta.url).href,
	},
	'ggr-l2': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-l2.png', import.meta.url).href,
	},
	'ggr-l3': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-l3.png', import.meta.url).href,
	},
	'ggr-l4': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-l4.png', import.meta.url).href,
	},
	'ggr-l5': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-l5.png', import.meta.url).href,
	},
	'ggr-h1': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-h1.png', import.meta.url).href,
	},
	'ggr-h2': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-h2.png', import.meta.url).href,
	},
	'ggr-h3': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-h3.png', import.meta.url).href,
	},
	'ggr-h4': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-h4.png', import.meta.url).href,
	},
	'ggr-w': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-w.png', import.meta.url).href,
	},
	'ggr-s': {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/symbol-s.png', import.meta.url).href,
	},
	slotBackground: {
		type: 'sprite',
		src: new URL('../assets/golden-goal-rush/slot-background.png', import.meta.url).href,
		preload: true,
	},
	spinButton: {
		type: 'sprite',
		src: new URL('../../../../packages/components-ui-pixi/src/spin-button.png', import.meta.url).href,
		preload: true,
	},

	goldFont: {
		type: 'font',
		src: new URL('../../assets/fonts/goldFont/mm_gold.xml', import.meta.url).href,
	},
	sound: {
		type: 'audio',
		src: new URL('../../assets/audio/sounds.json', import.meta.url).href,
		preload: true,
	},
} as const;
