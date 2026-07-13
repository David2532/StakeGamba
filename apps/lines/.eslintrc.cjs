module.exports = {
	root: true,
	extends: ['custom'],
	overrides: [
		{
			files: ['src/game/bookEventHandlerMap.ts'],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
			},
		},
	],
};
