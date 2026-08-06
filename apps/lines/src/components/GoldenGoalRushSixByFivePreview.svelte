<script lang="ts">
	import { onMount } from 'svelte';

	import { Container, Graphics, Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';
	import { formatCurrencyAmount } from 'utils-shared/currency.js';

	const STAGE = { width: 1366, height: 768 };
	const REELS = 6;
	const ROWS = 5;
	const CELL = 82;
	const GAP = 8;
	const GRID_WIDTH = REELS * CELL + (REELS - 1) * GAP;
	const GRID_HEIGHT = ROWS * CELL + (ROWS - 1) * GAP;
	const BOARD = {
		x: 303,
		y: 118,
		width: 760,
		height: 492,
	};
	const BOARD_RIGHT_PADDING = 64;
	const BOARD_LEFT_RAIL_WIDTH = BOARD.width - GRID_WIDTH - BOARD_RIGHT_PADDING;
	const GRID = {
		x: BOARD_LEFT_RAIL_WIDTH,
		y: Math.round((BOARD.height - GRID_HEIGHT) * 0.5),
		width: GRID_WIDTH,
		height: GRID_HEIGHT,
	};
	const CLUSTER_BADGE = {
		x: Math.round((BOARD_LEFT_RAIL_WIDTH - 70) * 0.5),
		y: Math.round(GRID.y + (GRID.height - 188) * 0.5),
		width: 70,
		height: 188,
	};
	const HUD = {
		y: 618,
		height: 118,
	};

	const symbolAssetKeys = {
		H1: 'ggr-h1',
		H2: 'ggr-h2',
		H3: 'ggr-h3',
		H4: 'ggr-h4',
		L1: 'ggr-l1',
		L2: 'ggr-l2',
		L3: 'ggr-l3',
		L4: 'ggr-l4',
		L5: 'ggr-l5',
		S: 'ggr-s',
		W: 'ggr-w',
	} as const;

	type SymbolName = keyof typeof symbolAssetKeys;

	const symbolSequence = [
		'H1',
		'L1',
		'H2',
		'L2',
		'W',
		'L3',
		'H3',
		'L4',
		'S',
		'L5',
		'H4',
	] as const satisfies readonly SymbolName[];

	const actionLabels = {
		spin: 'Spin',
		betDown: 'Decrease play amount',
		betUp: 'Increase play amount',
		bonusBuy: 'Bonus / Feature',
		auto: 'Auto',
		turbo: 'Turbo',
		menu: 'Menu',
		info: 'Info / Rules',
		settings: 'Settings',
	} as const;

	type ActionKey = keyof typeof actionLabels;

	const buttonSpecs = [
		{
			action: 'menu',
			assetKey: 'ggr-preview-menu',
			x: 64,
			y: 70,
			width: 54,
			height: 58,
		},
		{
			action: 'info',
			assetKey: 'ggr-preview-info',
			x: 126,
			y: 70,
			width: 54,
			height: 58,
		},
		{
			action: 'settings',
			assetKey: 'ggr-preview-settings',
			x: 188,
			y: 70,
			width: 54,
			height: 58,
		},
		{
			action: 'betDown',
			assetKey: 'ggr-preview-bet-down',
			x: 672,
			y: 668,
			width: 54,
			height: 54,
		},
		{
			action: 'betUp',
			assetKey: 'ggr-preview-bet-up',
			x: 848,
			y: 668,
			width: 54,
			height: 54,
		},
		{
			action: 'bonusBuy',
			assetKey: 'ggr-preview-bonus-buy',
			x: 1064,
			y: 674,
			width: 108,
			height: 74,
		},
		{
			action: 'auto',
			assetKey: 'ggr-preview-autospin',
			x: 1148,
			y: 674,
			width: 50,
			height: 50,
		},
		{
			action: 'spin',
			assetKey: 'ggr-preview-spin-button',
			x: 1224,
			y: 674,
			width: 104,
			height: 104,
		},
		{
			action: 'turbo',
			assetKey: 'ggr-preview-turbo',
			x: 1304,
			y: 674,
			width: 50,
			height: 50,
		},
	] as const satisfies readonly {
		action: ActionKey;
		assetKey: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}[];

	const renderedAssetKeys = [
		'slotBackground',
		'ggr-preview-logo',
		'ggr-preview-reel-frame',
		'ggr-preview-hud-wide',
		'ggr-preview-hud-small',
		'ggr-preview-bet-stepper',
		'ggr-preview-ways-badge',
		...Object.values(symbolAssetKeys),
		...buttonSpecs.map((button) => button.assetKey),
	] as const;

	const bets = [0.2, 0.4, 1, 2, 5, 10, 20] as const;
	const context = getContextApp();

	let viewport = $state({ ...STAGE });
	let spinOffset = $state(0);
	let balance = $state(10000);
	let win = $state(0);
	let betIndex = $state(2);
	let autoEnabled = $state(false);
	let turboEnabled = $state(false);
	let hoveredAction = $state<ActionKey | null>(null);
	let lastAction = $state('Ready');
	let clickCounts = $state<Record<ActionKey, number>>({
		spin: 0,
		betDown: 0,
		betUp: 0,
		bonusBuy: 0,
		auto: 0,
		turbo: 0,
		menu: 0,
		info: 0,
		settings: 0,
	});

	const stageScale = $derived(
		Math.min(viewport.width / STAGE.width, viewport.height / STAGE.height),
	);
	const stageX = $derived((viewport.width - STAGE.width * stageScale) * 0.5);
	const stageY = $derived((viewport.height - STAGE.height * stageScale) * 0.5);
	const bet = $derived(bets[betIndex]);
	const mockBoard = $derived(
		Array.from({ length: ROWS }, (_, row) =>
			Array.from(
				{ length: REELS },
				(_, reel) => symbolSequence[(row * REELS + reel + spinOffset) % symbolSequence.length],
			),
		),
	);

	const previewCurrency =
		typeof window === 'undefined'
			? 'USD'
			: new URLSearchParams(window.location.search).get('currency')?.toUpperCase() || 'USD';
	const formatCurrency = (value: number) => formatCurrencyAmount(value, previewCurrency);

	const getSymbolAccentColor = (symbol: SymbolName) => {
		if (symbol === 'W' || symbol === 'S') return 0x62ffb8;
		if (symbol.startsWith('H')) return 0xffd66b;
		return 0x235943;
	};

	const getSymbolAccentAlpha = (symbol: SymbolName) => {
		if (symbol === 'W' || symbol === 'S') return 0.32;
		if (symbol.startsWith('H')) return 0.24;
		return 0.12;
	};

	const getSymbolScale = (symbol: SymbolName) =>
		symbol.startsWith('H') || symbol === 'W' ? 0.91 : 0.86;

	const handleAction = (action: ActionKey) => {
		clickCounts[action] += 1;
		lastAction = actionLabels[action];
		console.log(`[ggr-six-by-five-preview] ${action} ${clickCounts[action]}`);

		if (action === 'spin') spinOffset = (spinOffset + 3) % symbolSequence.length;
		if (action === 'auto') autoEnabled = !autoEnabled;
		if (action === 'turbo') turboEnabled = !turboEnabled;
	};

	const getButtonActive = (action: ActionKey) =>
		(action === 'auto' && autoEnabled) || (action === 'turbo' && turboEnabled);

	const getButtonScale = (action: ActionKey) =>
		hoveredAction === action || getButtonActive(action) ? 1.07 : 1;

	onMount(() => {
		const syncViewport = () => {
			const canvasBounds = context.stateApp.pixiApplication?.canvas.getBoundingClientRect();
			const width = Math.min(
				window.innerWidth,
				document.documentElement.clientWidth || window.innerWidth,
				canvasBounds?.width || window.innerWidth,
			);
			const height = Math.min(
				window.innerHeight,
				document.documentElement.clientHeight || window.innerHeight,
				canvasBounds?.height || window.innerHeight,
			);

			viewport = {
				width,
				height,
			};
		};

		const resizeObserver = new ResizeObserver(syncViewport);
		if (context.stateApp.pixiApplication?.canvas) {
			resizeObserver.observe(context.stateApp.pixiApplication.canvas);
		}

		syncViewport();
		window.addEventListener('resize', syncViewport);
		return () => {
			window.removeEventListener('resize', syncViewport);
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') return;

		(window as Window & { __ggrSixByFivePreview?: unknown }).__ggrSixByFivePreview = {
			grid: `${REELS}x${ROWS}`,
			renderedAssetKeys,
			loadedAssetKeys: Object.keys(context.stateApp.loadedAssets ?? {}).sort(),
			buttonSpecs: buttonSpecs.map(({ action, x, y, width, height }) => ({
				action,
				x,
				y,
				width,
				height,
			})),
			clickCounts: { ...clickCounts },
			values: {
				balance,
				win,
				bet,
				badge: 'CLUSTER WINS',
				lastAction,
				autoEnabled,
				turboEnabled,
			},
		};
	});

	const panelLabelStyle = {
		fontFamily: 'Arial',
		fontSize: 12,
		fontWeight: '800',
		fill: 0x8fffd0,
		letterSpacing: 0,
	};

	const panelValueStyle = {
		fontFamily: 'Arial',
		fontSize: 25,
		fontWeight: '900',
		fill: 0xfff3b0,
		letterSpacing: 0,
	};

	const badgeLabelStyle = {
		fontFamily: 'Arial',
		fontSize: 10,
		fontWeight: '900',
		fill: 0x91ffd6,
		letterSpacing: 0,
	};

	const badgeValueStyle = {
		fontFamily: 'Arial',
		fontSize: 18,
		fontWeight: '900',
		fill: 0xfff5bc,
		letterSpacing: 0,
	};

	const statusValueStyle = $derived({
		fontFamily: 'Arial',
		fontSize: 18,
		fontWeight: '900',
		fill: autoEnabled || turboEnabled ? 0x9dffd5 : 0xfff1b4,
		letterSpacing: 0,
	});
</script>

<Container x={stageX} y={stageY} scale={stageScale}>
	<Sprite key="slotBackground" width={STAGE.width} height={STAGE.height} alpha={0.99} />

	<Graphics
		draw={(graphics) => {
			graphics.rect(0, 0, STAGE.width, STAGE.height);
			graphics.fill({ color: 0x020604, alpha: 0.12 });

			for (let ring = 6; ring >= 1; ring -= 1) {
				graphics.ellipse(STAGE.width * 0.5, 360, 116 * ring, 54 * ring);
				graphics.fill({ color: 0xffd36a, alpha: 0.012 });
			}

			for (let ring = 5; ring >= 1; ring -= 1) {
				graphics.ellipse(STAGE.width * 0.5, 408, 96 * ring, 42 * ring);
				graphics.fill({ color: 0x1dff91, alpha: 0.012 });
			}

			graphics.rect(0, 0, 260, STAGE.height);
			graphics.fill({ color: 0x000000, alpha: 0.46 });
			graphics.rect(STAGE.width - 260, 0, 260, STAGE.height);
			graphics.fill({ color: 0x000000, alpha: 0.46 });
			graphics.rect(0, 0, STAGE.width, 92);
			graphics.fill({ color: 0x000000, alpha: 0.42 });
			graphics.rect(0, STAGE.height - 112, STAGE.width, 112);
			graphics.fill({ color: 0x000000, alpha: 0.3 });
		}}
	/>

	<Rectangle
		x={34}
		y={32}
		width={1298}
		height={704}
		borderRadius={26}
		backgroundColor={0x010302}
		backgroundAlpha={0.15}
		borderColor={0xd2ab55}
		borderWidth={2}
		borderAlpha={0.4}
	/>

	<Container x={BOARD.x} y={BOARD.y}>
		<Rectangle
			x={24}
			y={22}
			width={BOARD.width - 48}
			height={BOARD.height - 26}
			borderRadius={34}
			backgroundColor={0x000000}
			backgroundAlpha={0.38}
		/>
		<Rectangle
			x={38}
			y={36}
			width={BOARD.width - 76}
			height={BOARD.height - 54}
			borderRadius={26}
			backgroundColor={0x0c1a10}
			backgroundAlpha={0.28}
			borderColor={0x31ff9b}
			borderWidth={3}
			borderAlpha={0.22}
		/>
		<Rectangle
			x={-14}
			y={-12}
			width={BOARD.width + 28}
			height={BOARD.height + 28}
			borderRadius={42}
			backgroundColor={0xd28a21}
			backgroundAlpha={0.08}
			borderColor={0xffcc5a}
			borderWidth={8}
			borderAlpha={0.16}
		/>
		<Sprite
			key="ggr-preview-reel-frame"
			x={0}
			y={0}
			width={BOARD.width}
			height={BOARD.height}
			alpha={0.98}
		/>
		<Rectangle
			x={28}
			y={GRID.y - 16}
			width={BOARD_LEFT_RAIL_WIDTH - 48}
			height={GRID.height + 32}
			borderRadius={26}
			backgroundColor={0x020705}
			backgroundAlpha={0.5}
			borderColor={0x18d179}
			borderWidth={2}
			borderAlpha={0.34}
		/>
		<Rectangle
			x={GRID.x - 26}
			y={GRID.y - 24}
			width={GRID.width + 52}
			height={GRID.height + 48}
			borderRadius={28}
			backgroundColor={0x020605}
			backgroundAlpha={0.86}
			borderColor={0x18d179}
			borderWidth={2}
			borderAlpha={0.58}
		/>
		<Rectangle
			x={GRID.x - 18}
			y={GRID.y - 16}
			width={GRID.width + 36}
			height={GRID.height + 32}
			borderRadius={22}
			backgroundColor={0x06110a}
			backgroundAlpha={0.82}
			borderColor={0xffd36a}
			borderWidth={1}
			borderAlpha={0.35}
		/>

		{#each mockBoard as row, rowIndex}
			{#each row as symbol, reelIndex}
				{@const x = GRID.x + reelIndex * (CELL + GAP)}
				{@const y = GRID.y + rowIndex * (CELL + GAP)}
				{@const accentColor = getSymbolAccentColor(symbol)}
				{@const accentAlpha = getSymbolAccentAlpha(symbol)}
				{@const symbolScale = getSymbolScale(symbol)}
				<Rectangle
					{x}
					{y}
					width={CELL}
					height={CELL}
					borderRadius={14}
					backgroundColor={(rowIndex + reelIndex) % 2 === 0 ? 0x06120c : 0x020705}
					backgroundAlpha={0.9}
					borderColor={accentColor}
					borderWidth={symbol.startsWith('H') || symbol === 'W' || symbol === 'S' ? 2 : 1}
					borderAlpha={symbol.startsWith('H') || symbol === 'W' || symbol === 'S' ? 0.62 : 0.26}
				/>
				<Rectangle
					x={x + 8}
					y={y + 11}
					width={CELL - 16}
					height={CELL - 10}
					borderRadius={18}
					backgroundColor={0x000000}
					backgroundAlpha={0.28}
				/>
				<Sprite
					key={symbolAssetKeys[symbol]}
					x={x + CELL * 0.5}
					y={y + CELL * 0.5 + 2}
					width={CELL * 0.98}
					height={CELL * 0.98}
					anchor={{ x: 0.5, y: 0.5 }}
					alpha={accentAlpha}
					tint={accentColor}
				/>
				<Sprite
					key={symbolAssetKeys[symbol]}
					x={x + CELL * 0.5}
					y={y + CELL * 0.5}
					width={CELL * symbolScale}
					height={CELL * symbolScale}
					anchor={{ x: 0.5, y: 0.5 }}
				/>
			{/each}
		{/each}

		<Rectangle
			x={34}
			y={28}
			width={BOARD.width - 68}
			height={BOARD.height - 54}
			borderRadius={30}
			backgroundAlpha={0}
			borderColor={0xffd56d}
			borderWidth={2}
			borderAlpha={0.34}
		/>

		<Sprite
			key="ggr-preview-ways-badge"
			x={CLUSTER_BADGE.x}
			y={CLUSTER_BADGE.y}
			width={CLUSTER_BADGE.width}
			height={CLUSTER_BADGE.height}
			alpha={0.98}
		/>
		<Text
			x={CLUSTER_BADGE.x + CLUSTER_BADGE.width * 0.5}
			y={CLUSTER_BADGE.y + 64}
			anchor={{ x: 0.5, y: 0.5 }}
			text="CLUSTER"
			style={badgeLabelStyle}
		/>
		<Text
			x={CLUSTER_BADGE.x + CLUSTER_BADGE.width * 0.5}
			y={CLUSTER_BADGE.y + 94}
			anchor={{ x: 0.5, y: 0.5 }}
			text="VALUES"
			style={badgeValueStyle}
		/>
	</Container>

	<Sprite
		key="ggr-preview-logo"
		x={683}
		y={20}
		width={286}
		height={162}
		anchor={{ x: 0.5, y: 0 }}
	/>

	<Container>
		<Rectangle
			x={42}
			y={HUD.y}
			width={1282}
			height={HUD.height}
			borderRadius={24}
			backgroundColor={0x030705}
			backgroundAlpha={0.76}
			borderColor={0xc69a41}
			borderWidth={2}
			borderAlpha={0.34}
		/>
		<Rectangle
			x={54}
			y={HUD.y + 10}
			width={1258}
			height={HUD.height - 20}
			borderRadius={20}
			backgroundColor={0x0a1b10}
			backgroundAlpha={0.22}
			borderColor={0x20e485}
			borderWidth={1}
			borderAlpha={0.22}
		/>

		<Sprite key="ggr-preview-hud-wide" x={78} y={636} width={254} height={59} />
		<Text x={101} y={647} text="BALANCE" style={panelLabelStyle} />
		<Text x={101} y={667} text={formatCurrency(balance)} style={panelValueStyle} />

		<Sprite key="ggr-preview-hud-wide" x={344} y={636} width={254} height={59} />
		<Text x={367} y={647} text="WIN" style={panelLabelStyle} />
		<Text x={367} y={667} text={formatCurrency(win)} style={panelValueStyle} />

		<Sprite key="ggr-preview-bet-stepper" x={610} y={628} width={270} height={78} />
		<Text x={760} y={640} anchor={{ x: 0.5, y: 0 }} text="PLAY" style={panelLabelStyle} />
		<Text
			x={760}
			y={662}
			anchor={{ x: 0.5, y: 0 }}
			text={formatCurrency(bet)}
			style={panelValueStyle}
		/>

		<Sprite key="ggr-preview-hud-small" x={886} y={636} width={124} height={68} />
		<Text x={948} y={648} anchor={{ x: 0.5, y: 0 }} text="MODE" style={panelLabelStyle} />
		<Text x={948} y={672} anchor={{ x: 0.5, y: 0 }} text={lastAction} style={statusValueStyle} />
	</Container>

	{#each buttonSpecs as button}
		<Container
			x={button.x}
			y={button.y}
			scale={getButtonScale(button.action)}
			eventMode="static"
			cursor="pointer"
			onpointerover={() => (hoveredAction = button.action)}
			onpointerout={() => {
				if (hoveredAction === button.action) hoveredAction = null;
			}}
			onpointerup={() => handleAction(button.action)}
		>
			<Rectangle
				width={button.width + 14}
				height={button.height + 14}
				anchor={0.5}
				borderRadius={button.action === 'spin' ? 48 : 18}
				backgroundColor={getButtonActive(button.action) ? 0x25ff93 : 0xffc657}
				backgroundAlpha={getButtonActive(button.action) ? 0.16 : 0.1}
			/>
			<Sprite
				key={button.assetKey}
				width={button.width}
				height={button.height}
				anchor={{ x: 0.5, y: 0.5 }}
				alpha={getButtonActive(button.action) ? 1 : 0.96}
				tint={getButtonActive(button.action) ? 0xbaffdf : 0xffffff}
			/>
		</Container>
	{/each}
</Container>
