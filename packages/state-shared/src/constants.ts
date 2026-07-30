const DEFAULT_BET_MODE_META = {
	BASE: {
		mode: 'BASE',
		costMultiplier: 1.0,
		type: 'default',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage: '',
			dialogVolatility: '',
			volatility: '',
			button: '',
		},
		text: {
			title: '',
			dialog: '',
			button: '',
			betAmountLabel: '',
			tickerIdle: '',
			tickerSpin: '',
			bannerText: '',
		},
		maxWin: 8888,
	},
	ANTE: {
		mode: 'ANTE',
		costMultiplier: 1.2,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: 'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/icon_doubleboost.webp',
			dialogImage:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/doubleboost_image.webp',
			dialogVolatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_01.webp',
			volatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_white_01.webp',
			button:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/button_activate.webp',
			bannerText: 'example banner text',
		},
		text: {
			title: 'DOUBLE BOOST',
			dialog:
				'Double the chance to trigger the FREE SPINS round when activated for 1.2x the player play amount. DOUBLE BOOST remains active until disabled by the player.',
			description: 'Greatly increase your chance of landing a bonus symbol each spin.',
			button: 'ACTIVATE',
			betAmountLabel: 'DOUBLE BOOST',
			tickerIdle: 'DOUBLE BOOST IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	SUPERANTE: {
		mode: 'SUPERANTE',
		costMultiplier: 5,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: 'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/icon_superboost.webp',
			dialogImage:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/superboost_image.webp',
			dialogVolatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_02.webp',
			volatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_white_02.webp',
			button:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/button_activate.webp',
		},
		text: {
			title: 'SUPER BOOST',
			dialog:
				'1 in 20 chance to trigger the FREE SPINS round when activated for 5x the player play amount. Guarantees 1 or more Scatter symbols every spin. SUPER BOOST remains active until disabled by the player.',
			description: 'Guaranteed to land at least 1+ bonus symbol each spin.',
			button: 'ACTIVATE',
			betAmountLabel: 'SUPER BOOST',
			tickerIdle: 'SUPER BOOST IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	SUPERSPIN: {
		mode: 'SUPERSPIN',
		costMultiplier: 25,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: 'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/icon_superspin.webp',
			dialogImage:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/superspin_image.webp',
			dialogVolatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_03.webp',
			volatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_white_03.webp',
			button:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/button_activate.webp',
		},
		text: {
			title: 'SAMURAI SPIN',
			dialog:
				'All game features are boosted when activated for 25x the player play amount. SAMURAI SPIN remains active until disabled by the player.',
			description: 'SAMURAI SPIN is AWESOME! ',
			button: 'ACTIVATE',
			betAmountLabel: 'SAMURAI SPIN',
			tickerIdle: 'SAMURAI SPIN IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	BONUS: {
		mode: 'BONUS',
		costMultiplier: 100,
		type: 'buy',
		parent: '',
		children: '',
		assets: {
			icon: 'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/icon_bonusbuy.webp',
			dialogImage:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/bonus_image.webp',
			dialogVolatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_04.webp',
			volatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_white_04.webp',
			button:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_8_97/betModes/button_buy.webp',
		},
		text: {
			title: 'BONUS',
			dialog:
				'Triggers FREE SPINS feature when activated for 100x the player play amount. The Global Multiplier can reach up to 64x and remains active for the duration of FREE SPINS.',
			description: 'Each spin may have a random multiplier applied to winning lines.',
			button: 'ACTIVATE',
			tickerIdle: 'SELECT YOUR PLAY AMOUNT',
			tickerSpin: 'BONUS FEATURE ACTIVATED',
			bannerText: 'example banner text',
		},
	},
	SUPER: {
		mode: 'SUPER',
		costMultiplier: 200,
		type: 'buy',
		parent: '',
		children: '',
		assets: {
			icon: 'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/icon_superbonusbuy.webp',
			dialogImage:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/superbonus_image.webp',
			dialogVolatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_05.webp',
			volatility:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_9_97/betModes/volatility/volatility_white_05.webp',
			button:
				'https://test-fart-cdn-bucket.s3.ap-southeast-2.amazonaws.com/1_8_97/betModes/button_buy.webp',
		},
		text: {
			title: 'SUPER BONUS',
			dialog:
				'Triggers FREE SPINS feature when activated for 200x the player play amount. The Global Multiplier can reach up to 256x and remains active for the duration of FREE SPINS.',
			description: 'Enter the mothership! Land values and multiply them with action symbols.',
			button: 'ACTIVATE',
			tickerIdle: 'SELECT YOUR PLAY AMOUNT',
			tickerSpin: 'SUPER BONUS FEATURE ACTIVATED',
			bannerText: 'example banner text',
		},
	},
};

const DEFAULT_GAME_RULE_META = {
	payTable: [
		{
			containers: [
				{
					title: 'WILD SYMBOL',
					text: 'The Wild symbol substitutes all other symbols except Scatter.',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 0,
					column: 0,
				},
				{
					title: 'FREE SPINS',
					text: 'Scatter Symbols are on all reels. If at least 3 Scatters land in a spin sequence, FREE SPINS is triggered. 3 Scatters award 8 FREE SPINS. 4 Scatters award 12 FREE SPINS. 5 Scatters award 16 FREE SPINS. ',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 1,
					column: 0,
				},
				{
					title: 'FREE SPINS RETRIGGER',
					text: 'During FREE SPINS, Scatter Symbols are on all reels. If at least 3 Scatters land in a spin sequence, additional FREE SPINS rounds are triggered. 3 Scatters award 4 additional FREE SPINS. 4 Scatters award 6 additional FREE SPINS. 5 Scatters award 8 additional FREE SPINS. ',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 2,
					column: 0,
				},
			],
			rows: 3,
			columns: 1,
			title: 'SYMBOL TABLE',
		},
		{
			containers: [
				{
					title: '',
					text: '5	|	10x\n4	|	5x\n3	|	2x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 0,
					column: 0,
				},
				{
					title: '',
					text: '5	|	5x\n4	|	2x\n3	|	1x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 0,
					column: 1,
				},
				{
					title: '',
					text: '5	|	5x\n4	|	2x\n3	|	1x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 0,
					column: 2,
				},
				{
					title: '',
					text: '5	|	3x\n4	|	1x\n3	|	0.5x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 1,
					column: 0,
				},
				{
					title: '',
					text: '5	|	3x\n4	|	1x\n3	|	0.5x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 1,
					column: 1,
				},
				{
					title: '',
					text: '5	|	2x\n4	|	0.8x\n3	|	0.4x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 3,
					column: 0,
				},
				{
					title: '',
					text: '5	|	2x\n4	|	0.8x\n3	|	0.4x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 3,
					column: 1,
				},
				{
					title: '',
					text: '5	|	1.5x\n4	|	0.5x\n3	|	0.2x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 3,
					column: 2,
				},
				{
					title: '',
					text: '5	|	1.5x\n4	|	0.5x\n3	|	0.2x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 4,
					column: 0,
				},
				{
					title: '',
					text: '5	|	1x\n4	|	0.3x\n3	|	0.1x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 4,
					column: 1,
				},
				{
					title: '',
					text: '5	|	1x\n4	|	0.3x\n3	|	0.1x\n',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/wild.ac78fbf6.png',
					imagePosition: 'left',
					row: 4,
					column: 2,
				},
			],
			rows: 5,
			columns: 3,
			title: 'SYMBOLS',
		},
		{
			containers: [
				{
					title: '',
					text: 'All symbols award wins from left to right, starting from the leftmost reel. Only symbols on adjacent reels form a valid win way. This does not apply to Scatter. ',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/winWays.be45a8a4.png',
					imagePosition: 'top',
					row: 0,
					column: 0,
				},
			],
			rows: 1,
			columns: 1,
			title: 'WIN WAYS',
		},
	],
	gameRules: [
		{
			containers: [
				{
					title: '',
					text: 'The normal mode of this game has a theoretical expected return of 97.0%.\n\nThe player may select an ANTE PLAY mode. This costs 1.25x the underlying play amount. ANTE PLAY has a theoretical expected return of 97.0% and doubles the chance of FREE SPINS.\n\nThe player may activate FREE SPINS for 100x the underlying play amount. This feature mode has a theoretical expected return of 97.0%.\n\nThe player may activate a SUPER SPIN for 25x the underlying play amount. This mode has a theoretical expected return of 97.0%. In SUPER SPIN one spin is initially awarded. On each spin stacked Wild Symbols are on Reel Strips.\n\nThe maximum win in each Play Mode is 5000x the underlying play amount.',
					image: 'https://staging-1-0.twist-game.app/_app/immutable/assets/rtp97.d2febd7d.svg',
					imagePosition: 'top',
					row: 0,
					column: 0,
				},
			],
			rows: 1,
			columns: 1,
			title: 'PLAY MODES',
		},
		{
			containers: [
				{
					title: '',
					text: 'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any incomplete plays. The theoretical expected return is calculated over many spins. Movement of reels is not representative of any physical device and is for illustrative purposes only. TM and \u00a9 2023 Twist Gaming.',
					image: '',
					row: 0,
					column: 0,
				},
			],
			rows: 1,
			columns: 1,
			title: 'LEGAL NOTICE',
		},
		{
			containers: [
				{
					title: '',
					text: 'SPIN BUTTON | Initiates the play round.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleSpin.daacc43a.webp',
					imagePosition: 'left',
					row: 0,
					column: 0,
				},
				{
					title: '',
					text: 'STOP BUTTON | Stops the current Spin.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleStop.30db74c5.webp',
					imagePosition: 'left',
					row: 1,
					column: 0,
				},
				{
					title: '',
					text: 'INFORMATION | Provides Game Information.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 2,
					column: 0,
				},
				{
					title: '',
					text: 'SETTINGS | Adjust Game Settings.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 4,
					column: 0,
				},
				{
					title: '',
					text: 'SYMBOL TABLE | View the Symbol Table to see Symbol Values.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 6,
					column: 0,
				},
				{
					title: '',
					text: 'AUTO SPIN | Open the Auto Spin pop-up menu.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleAutoSpin.d542a3b0.webp',
					imagePosition: 'left',
					row: 7,
					column: 0,
				},

				{
					title: '',
					text: 'TURBO | Activate Turbo Mode.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleTurbo.a0fcfd04.webp',
					imagePosition: 'left',
					row: 9,
					column: 0,
				},
				{
					title: '',
					text: 'MENU | Expands the Sidebar Menu for more Options.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 10,
					column: 0,
				},
				{
					title: '',
					text: 'CLOSE | Exit the pop-up menu.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 11,
					column: 0,
				},
				{
					title: '',
					text: 'SOUND | Mute or Unmute Game Audio.',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 12,
					column: 0,
				},
				{
					title: '',
					text: 'INCREASE | Increase your Play Amount',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 13,
					column: 0,
				},
				{
					title: '',
					text: 'DECREASE | Decrease your Play Amount',
					image:
						'https://staging-1-0.twist-game.app/_app/immutable/assets/gameRuleDown.716ec429.webp',
					imagePosition: 'left',
					row: 14,
					column: 0,
				},
			],
			rows: 16,
			columns: 1,
			title: 'USER INTERFACE GUIDE',
		},
	],
	splashScreen: [],
};

export { DEFAULT_BET_MODE_META, DEFAULT_GAME_RULE_META };
