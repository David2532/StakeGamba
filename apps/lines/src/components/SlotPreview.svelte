<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';

	type Props = {
		showHud?: boolean;
		autoSpin?: boolean;
		debug?: boolean;
		view?: string;
	};
	const { showHud = true, autoSpin = false, debug = true, view = 'slot' }: Props = $props();

	const app = getContextApp();
	const screen = $derived(
		app.stateApp.pixiApplication?.screen ?? { width: 1280, height: 720 },
	);
	const assetCount = $derived(Object.keys(app.stateApp.loadedAssets ?? {}).length);

	const REELS = 6;
	const ROWS = 5;

	// symbol name -> registered sprite asset key (matches assets.ts)
	const assetKey = (name: string) => `ggr-${name.toLowerCase()}`;
	const POOL = ['L1', 'L2', 'L3', 'L4', 'L5', 'L1', 'L2', 'L3', 'H1', 'H2', 'H3', 'H4', 'W', 'S'];
	const randomName = () => POOL[Math.floor(Math.random() * POOL.length)];
	const makeBoard = (): string[][] =>
		Array.from({ length: REELS }, () => Array.from({ length: ROWS }, randomName));

	let board = $state<string[][]>(makeBoard());
	let spinning = $state(false);
	let auto = $state(autoSpin);
	let lastWin = $state(0);
	let balance = $state(1000);
	const bet = 1;

	// ---- responsive layout ----
	const hudH = $derived(showHud ? Math.min(screen.height * 0.16, 140) : 0);
	const logoH = $derived(Math.min(screen.height * 0.16, 150));
	const boardAreaTop = $derived(logoH * 0.95);
	const boardAreaH = $derived(screen.height - boardAreaTop - hudH - screen.height * 0.04);
	const boardAreaW = $derived(screen.width * 0.94);
	const cell = $derived(Math.max(40, Math.min(boardAreaW / REELS, boardAreaH / ROWS)));
	const boardW = $derived(cell * REELS);
	const boardH = $derived(cell * ROWS);
	const cx = $derived(screen.width / 2);
	const boardLeft = $derived(cx - boardW / 2);
	const boardTop = $derived(boardAreaTop + (boardAreaH - boardH) / 2);

	// cover-fit background
	const bgRatio = 1672 / 941;
	const cover = $derived.by(() => {
		const r = screen.width / screen.height;
		return r > bgRatio
			? { width: screen.width, height: screen.width / bgRatio }
			: { width: screen.height * bgRatio, height: screen.height };
	});
	const logoRatio = 1047 / 1516;
	const logoW = $derived(Math.min(screen.width * 0.42, 560));

	const cellCx = (reel: number) => boardLeft + reel * cell + cell / 2;
	const cellCy = (row: number) => boardTop + row * cell + cell / 2;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	async function spin() {
		if (spinning) return;
		spinning = true;
		// visible "spin": a few quick reshuffles, then settle
		for (let i = 0; i < 6; i++) {
			board = makeBoard();
			await sleep(70);
		}
		board = makeBoard();
		// playful demo win readout (not real math)
		lastWin = Math.random() < 0.45 ? Math.round((Math.random() * 24 + 1) * bet * 100) / 100 : 0;
		balance = Math.round((balance - bet + lastWin) * 100) / 100;
		spinning = false;
	}

	onMount(() => {
		let cancelled = false;
		(async () => {
			while (!cancelled) {
				await sleep(2600);
				if (!cancelled && auto && !spinning) await spin();
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	// simple pill button helper rendered inline via snippet
</script>

<!-- background -->
<Rectangle x={0} y={0} width={screen.width} height={screen.height} backgroundColor={0x05080f} />
<Sprite
	key="slotBackground"
	anchor={0.5}
	x={cx}
	y={screen.height / 2}
	width={cover.width}
	height={cover.height}
/>
<Sprite
	key="logoHorizontal"
	anchor={0.5}
	x={cx}
	y={logoH * 0.5}
	width={logoW}
	height={logoW * logoRatio}
/>

<!-- board frame -->
<Rectangle
	anchor={0.5}
	x={cx}
	y={boardTop + boardH / 2}
	width={boardW + cell * 0.42}
	height={boardH + cell * 0.42}
	backgroundColor={0x06101f}
	backgroundAlpha={0.82}
	borderColor={0xf3c64c}
	borderWidth={Math.max(4, cell * 0.06)}
	borderRadius={24}
/>

<!-- symbol grid -->
{#each board as reelCells, reel}
	{#each reelCells as name, row}
		<Rectangle
			anchor={0.5}
			x={cellCx(reel)}
			y={cellCy(row)}
			width={cell * 0.92}
			height={cell * 0.92}
			backgroundColor={(reel + row) % 2 === 0 ? 0x0c1a33 : 0x0a1730}
			backgroundAlpha={0.66}
			borderColor={0x274a7d}
			borderWidth={2}
			borderRadius={12}
		/>
		<Sprite
			key={assetKey(name)}
			anchor={0.5}
			x={cellCx(reel)}
			y={cellCy(row)}
			width={cell * 0.82}
			height={cell * 0.82}
		/>
	{/each}
{/each}

<!-- HUD -->
{#if showHud}
	{@const hy = screen.height - hudH / 2}
	<Rectangle
		anchor={{ x: 0, y: 0.5 }}
		x={0}
		y={hy}
		width={screen.width}
		height={hudH * 0.82}
		backgroundColor={0x070d1a}
		backgroundAlpha={0.92}
		borderColor={0xf3c64c}
		borderWidth={3}
		borderRadius={18}
	/>

	<!-- Balance -->
	<Text
		anchor={{ x: 0, y: 0.5 }}
		x={screen.width * 0.03}
		y={hy - hudH * 0.12}
		text="BALANCE"
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }}
	/>
	<Text
		anchor={{ x: 0, y: 0.5 }}
		x={screen.width * 0.03}
		y={hy + hudH * 0.12}
		text={balance.toFixed(2)}
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0xffffff }}
	/>

	<!-- Bet -->
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		x={screen.width * 0.32}
		y={hy - hudH * 0.12}
		text="BET"
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }}
	/>
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		x={screen.width * 0.32}
		y={hy + hudH * 0.12}
		text={bet.toFixed(2)}
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0xffffff }}
	/>

	<!-- Win -->
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		x={screen.width * 0.45}
		y={hy - hudH * 0.12}
		text="WIN"
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }}
	/>
	<Text
		anchor={{ x: 0.5, y: 0.5 }}
		x={screen.width * 0.45}
		y={hy + hudH * 0.12}
		text={lastWin.toFixed(2)}
		style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0x12d36a }}
	/>

	<!-- Bonus Buy -->
	<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
		<Rectangle
			anchor={0.5}
			x={screen.width * 0.62}
			y={hy}
			width={Math.min(screen.width * 0.14, 150)}
			height={hudH * 0.5}
			backgroundColor={0x3a1020}
			borderColor={0xc5495f}
			borderWidth={2}
			borderRadius={14}
		/>
		<Text
			anchor={0.5}
			x={screen.width * 0.62}
			y={hy}
			text="BONUS BUY"
			style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '800', fill: 0xffd0d8 }}
		/>
	</Container>

	<!-- Turbo -->
	<Container eventMode="static" cursor="pointer" onpointertap={() => (auto = !auto)}>
		<Rectangle
			anchor={0.5}
			x={screen.width * 0.76}
			y={hy}
			width={Math.min(screen.width * 0.1, 110)}
			height={hudH * 0.5}
			backgroundColor={auto ? 0x123a22 : 0x10203a}
			borderColor={auto ? 0x12d36a : 0x2a4a78}
			borderWidth={2}
			borderRadius={14}
		/>
		<Text
			anchor={0.5}
			x={screen.width * 0.76}
			y={hy}
			text={auto ? 'AUTO ON' : 'AUTO'}
			style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '800', fill: 0xffffff }}
		/>
	</Container>

	<!-- SPIN -->
	<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
		<Rectangle
			anchor={0.5}
			x={screen.width * 0.92}
			y={hy}
			width={Math.min(screen.width * 0.13, 150)}
			height={hudH * 0.66}
			backgroundColor={spinning ? 0x0c5a2a : 0x12a84a}
			borderColor={0xf3c64c}
			borderWidth={3}
			borderRadius={20}
		/>
		<Text
			anchor={0.5}
			x={screen.width * 0.92}
			y={hy}
			text={spinning ? '...' : 'SPIN'}
			style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0xffffff }}
		/>
	</Container>
{/if}

<!-- debug overlay -->
{#if debug}
	<Text
		anchor={{ x: 0, y: 0 }}
		x={8}
		y={8}
		text={`view:${view} board:✓ hud:${showHud ? '✓' : '–'} assets:${assetCount} cell:${Math.round(cell)}`}
		style={{ fontFamily: 'monospace', fontSize: 14, fill: 0x9fe0b0 }}
	/>
{/if}
