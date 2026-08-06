module.exports = {
	root: true,
	extends: ['custom'],
	overrides: [
		{
			files: [
				'src/game/bookEventHandlerMap.ts',
				'src/game/constants.ts',
				'src/game/utils.ts',
			],
			rules: {
				'@typescript-eslint/no-unused-vars': 'off',
			},
		},
	],
};
