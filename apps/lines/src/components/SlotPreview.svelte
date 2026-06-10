<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Container, Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';

	import { MULTIPLIER_VALUES, coinAssetKey } from '../game/leBanditEngine';

	type Props = { showHud?: boolean; debug?: boolean; view?: string };
	const { showHud = true, debug = true, view = 'slot' }: Props = $props();

	const app = getContextApp();
	const screen = $derived(app.stateApp.pixiApplication?.screen ?? { width: 1280, height: 720 });
	const assetCount = $derived(Object.keys(app.stateApp.loadedAssets ?? {}).length);

	const REELS = 6;
	const ROWS = 5;

	type Kind = 'symbol' | 'coin' | 'collector' | 'scatter' | 'blank' | 'spent';
	type Cell = {
		kind: Kind;
		name: string; // for symbol
		value: number; // for coin
		locked: boolean;
		drop: Tween<number>; // cell units above target (0 = settled)
		pulse: Tween<number>; // scale factor for land/collect pop
	};

	const SYMBOLS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L1', 'L2', 'L3', 'H1', 'H2', 'H3', 'H4', 'W'];
	const rnd = (n: number) => Math.floor(Math.random() * n);
	const pick = <T,>(a: readonly T[]) => a[rnd(a.length)];
	const assetKey = (name: string) => `ggr-${name.toLowerCase()}`;
	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	const mkCell = (kind: Kind = 'symbol'): Cell => ({
		kind,
		name: pick(SYMBOLS),
		value: 0,
		locked: false,
		drop: new Tween(0, { duration: 340, easing: backOut }),
		pulse: new Tween(1, { duration: 150, easing: cubicOut }),
	});

	let cells = $state<Cell[][]>(
		Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => mkCell('symbol'))),
	);

	// ---- state machine ----
	type Phase = 'base' | 'spinning' | 'cascading' | 'featureIntro' | 'featureRespins' | 'featureOutro';
	let phase = $state<Phase>('base');
	let featureActive = $state(false);
	let respinsLeft = $state(0);
	let totalFeatureWin = $state(0);
	let lastSpinResult = $state('—');
	let balance = $state(1000);
	let lastWin = $state(0);
	let busy = $state(false);
	let forceFeature = $state(false);
	const bet = 1;

	const coinsLocked = $derived(
		cells.flat().filter((c) => c.kind === 'coin' || c.kind === 'spent').length,
	);

	// ---- layout (responsive) ----
	const hudH = $derived(showHud ? Math.min(screen.height * 0.15, 132) : 0);
	const logoH = $derived(Math.min(screen.height * 0.15, 140));
	const areaTop = $derived(logoH * 0.92);
	const areaH = $derived(screen.height - areaTop - hudH - screen.height * 0.03);
	const areaW = $derived(screen.width * 0.96);
	const SZ = $derived(Math.max(38, Math.min(areaW / REELS, areaH / ROWS)));
	const boardW = $derived(SZ * REELS);
	const boardH = $derived(SZ * ROWS);
	const cx = $derived(screen.width / 2);
	const boardLeft = $derived(cx - boardW / 2);
	const boardTop = $derived(areaTop + (areaH - boardH) / 2);
	const cellCx = (reel: number) => boardLeft + reel * SZ + SZ / 2;
	const cellCy = (row: number) => boardTop + row * SZ + SZ / 2;

	const bgRatio = 1672 / 941;
	const cover = $derived.by(() => {
		const r = screen.width / screen.height;
		return r > bgRatio
			? { width: screen.width, height: screen.width / bgRatio }
			: { width: screen.height * bgRatio, height: screen.height };
	});
	const logoRatio = 1047 / 1516;
	const logoW = $derived(Math.min(screen.width * 0.4, 540));

	const pop = (c: Cell) => {
		c.pulse.set(1.3, { duration: 110 }).then(() => c.pulse.set(1, { duration: 200 }));
	};

	// drop one reel (staggered by caller), assigning new cells
	const dropReel = (reel: number, newCells: Cell[]) => {
		cells[reel] = newCells;
		newCells.forEach((c, row) => {
			c.drop.set(ROWS + 1.5 - row, { duration: 0 });
			c.drop.set(0, { duration: 320 + row * 26, easing: backOut });
		});
	};

	// ---- base spin ----
	async function dropBaseBoard() {
		const scatterChance = forceFeature ? 0.16 : 0.05;
		let scatters = 0;
		for (let reel = 0; reel < REELS; reel++) {
			const newCells = Array.from({ length: ROWS }, () => {
				const c = mkCell('symbol');
				if (Math.random() < scatterChance) {
					c.kind = 'scatter';
					scatters++;
				}
				return c;
			});
			dropReel(reel, newCells);
			await sleep(110); // staggered column stop
		}
		await sleep(360);
		// land pop for scatters
		cells.flat().forEach((c) => c.kind === 'scatter' && pop(c));
		if (scatters) await sleep(300);
		return { scatters };
	}

	// ---- light single cascade pass (demo) ----
	async function cascadeOnce() {
		// find vertical runs of >=3 same symbol, pop + replace once
		const toReplace: { reel: number; row: number }[] = [];
		for (let reel = 0; reel < REELS; reel++) {
			let run = 1;
			for (let row = 1; row < ROWS; row++) {
				const a = cells[reel][row];
				const b = cells[reel][row - 1];
				if (a.kind === 'symbol' && b.kind === 'symbol' && a.name === b.name) run++;
				else run = 1;
				if (run >= 3) {
					for (let k = 0; k < run; k++) toReplace.push({ reel, row: row - k });
				}
			}
		}
		if (!toReplace.length) return 0;
		toReplace.forEach(({ reel, row }) => pop(cells[reel][row]));
		await sleep(280);
		toReplace.forEach(({ reel, row }) => {
			const c = mkCell('symbol');
			cells[reel][row] = c;
			c.drop.set(ROWS + 1, { duration: 0 });
			c.drop.set(0, { duration: 320, easing: backOut });
		});
		await sleep(360);
		const win = Math.round(toReplace.length * bet * 0.5 * 100) / 100;
		lastWin += win;
		return win;
	}

	// ---- feature (Money-Cart / Le-Bandit collect respins) ----
	function clearToFeatureGrid() {
		cells = Array.from({ length: REELS }, () =>
			Array.from({ length: ROWS }, () => {
				const c = mkCell('blank');
				return c;
			}),
		);
	}

	const emptyCells = () => {
		const out: { reel: number; row: number }[] = [];
		for (let reel = 0; reel < REELS; reel++)
			for (let row = 0; row < ROWS; row++) if (cells[reel][row].kind === 'blank') out.push({ reel, row });
		return out;
	};

	async function featureRespin() {
		const empties = emptyCells();
		let newSpecial = false;
		// each empty cell: small chance to land a coin or collector
		for (const { reel, row } of empties) {
			const roll = Math.random();
			if (roll < 0.16) {
				const c = mkCell('coin');
				c.value = pick(MULTIPLIER_VALUES);
				c.locked = true;
				cells[reel][row] = c;
				c.drop.set(ROWS + 1 - row, { duration: 0 });
				c.drop.set(0, { duration: 320, easing: backOut });
				newSpecial = true;
			} else if (roll < 0.2) {
				const c = mkCell('collector');
				c.locked = true;
				cells[reel][row] = c;
				c.drop.set(ROWS + 1 - row, { duration: 0 });
				c.drop.set(0, { duration: 320, easing: backOut });
				newSpecial = true;
			}
		}
		await sleep(380);
		// collectors collect all coins on grid, then become spent (no recount)
		const collectors = cells.flat().filter((c) => c.kind === 'collector');
		if (collectors.length) {
			const coinSum = cells
				.flat()
				.filter((c) => c.kind === 'coin')
				.reduce((s, c) => s + c.value, 0);
			for (const col of collectors) {
				totalFeatureWin += coinSum;
				pop(col);
				col.kind = 'spent';
			}
			cells.flat().forEach((c) => c.kind === 'coin' && pop(c));
			await sleep(420);
		}
		return { newSpecial };
	}

	async function runFeature() {
		phase = 'featureIntro';
		featureActive = true;
		totalFeatureWin = 0;
		respinsLeft = 3;
		lastSpinResult = 'FEATURE TRIGGERED';
		clearToFeatureGrid();
		await sleep(950);

		phase = 'featureRespins';
		let iter = 0;
		while (respinsLeft > 0 && iter < 60 && emptyCells().length > 0) {
			iter++;
			const { newSpecial } = await featureRespin();
			respinsLeft = newSpecial ? 3 : respinsLeft - 1;
			await sleep(260);
		}

		phase = 'featureOutro';
		lastWin = Math.round(totalFeatureWin * bet * 100) / 100;
		balance = Math.round((balance + lastWin) * 100) / 100;
		lastSpinResult = `FEATURE ${totalFeatureWin}x`;
		await sleep(1300);
		featureActive = false;
		phase = 'base';
	}

	async function spin() {
		if (busy) return;
		busy = true;
		lastWin = 0;
		balance = Math.round((balance - bet) * 100) / 100;

		phase = 'spinning';
		const { scatters } = await dropBaseBoard();

		phase = 'cascading';
		await cascadeOnce();

		const trigger = forceFeature || scatters >= 3;
		forceFeature = false;
		if (trigger) {
			await runFeature();
		} else {
			lastSpinResult = `scatters ${scatters} · win ${lastWin}`;
			balance = Math.round((balance + lastWin) * 100) / 100;
			phase = 'base';
		}
		busy = false;
	}

	const triggerFeatureNext = () => {
		forceFeature = true;
		if (!busy) spin();
	};

	onMount(() => {
		// settle initial board
		cells.flat().forEach((c) => c.drop.set(0, { duration: 0 }));
	});

	const PHASE_COLOR: Record<Phase, number> = {
		base: 0x8fb0d8,
		spinning: 0xffd447,
		cascading: 0x7ad0ff,
		featureIntro: 0xff8a3d,
		featureRespins: 0x12d36a,
		featureOutro: 0xf4d276,
	};
</script>

<!-- background -->
<Rectangle x={0} y={0} width={screen.width} height={screen.height} backgroundColor={0x05080f} />
<Sprite key="slotBackground" anchor={0.5} x={cx} y={screen.height / 2} width={cover.width} height={cover.height} />
<Sprite key="logoHorizontal" anchor={0.5} x={cx} y={logoH * 0.5} width={logoW} height={logoW * logoRatio} />

<!-- board frame -->
<Rectangle
	anchor={0.5}
	x={cx}
	y={boardTop + boardH / 2}
	width={boardW + SZ * 0.4}
	height={boardH + SZ * 0.4}
	backgroundColor={0x06101f}
	backgroundAlpha={featureActive ? 0.9 : 0.8}
	borderColor={featureActive ? 0xff9a3d : 0xf3c64c}
	borderWidth={Math.max(4, SZ * 0.06)}
	borderRadius={22}
/>

<!-- grid -->
{#each cells as reelCells, reel}
	{#each reelCells as c, row}
		{@const px = cellCx(reel)}
		{@const py = cellCy(row) - SZ * c.drop.current}
		<Rectangle
			anchor={0.5}
			x={px}
			y={cellCy(row)}
			width={SZ * 0.94}
			height={SZ * 0.94}
			backgroundColor={(reel + row) % 2 === 0 ? 0x0c1a33 : 0x0a1730}
			backgroundAlpha={0.6}
			borderColor={c.locked ? 0xf3c64c : 0x274a7d}
			borderWidth={c.locked ? 3 : 2}
			borderRadius={10}
		/>
		{#if c.kind === 'symbol'}
			<Sprite key={assetKey(c.name)} anchor={0.5} x={px} y={py} width={SZ * 0.82 * c.pulse.current} height={SZ * 0.82 * c.pulse.current} />
		{:else if c.kind === 'scatter'}
			<Sprite key="ggr-s" anchor={0.5} x={px} y={py} width={SZ * 0.88 * c.pulse.current} height={SZ * 0.88 * c.pulse.current} />
		{:else if c.kind === 'coin'}
			<Sprite key={coinAssetKey(c.value)} anchor={0.5} x={px} y={py} width={SZ * 0.86 * c.pulse.current} height={SZ * 0.86 * c.pulse.current} />
		{:else if c.kind === 'collector'}
			<Sprite key="symbolCollector" anchor={0.5} x={px} y={py} width={SZ * 0.9 * c.pulse.current} height={SZ * 0.9 * c.pulse.current} />
		{:else if c.kind === 'spent'}
			<Sprite key="symbolCollector" anchor={0.5} x={px} y={py} width={SZ * 0.7} height={SZ * 0.7} />
		{/if}
	{/each}
{/each}

<!-- feature banner -->
{#if phase === 'featureIntro' || phase === 'featureOutro'}
	<Rectangle anchor={0.5} x={cx} y={screen.height * 0.5} width={screen.width * 0.7} height={screen.height * 0.16} backgroundColor={0x1a0a02} backgroundAlpha={0.9} borderColor={0xffb04d} borderWidth={4} borderRadius={20} />
	<Text anchor={0.5} x={cx} y={screen.height * 0.5} text={phase === 'featureIntro' ? '⚽ BONUS COLLECT!' : `TOTAL ${totalFeatureWin}x`} style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.06, fontWeight: '900', fill: 0xffd447 }} />
{/if}

<!-- HUD -->
{#if showHud}
	{@const hy = screen.height - hudH / 2}
	<Rectangle anchor={{ x: 0, y: 0.5 }} x={0} y={hy} width={screen.width} height={hudH * 0.84} backgroundColor={0x070d1a} backgroundAlpha={0.92} borderColor={0xf3c64c} borderWidth={3} borderRadius={16} />
	<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.03} y={hy - hudH * 0.13} text="BALANCE" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }} />
	<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.03} y={hy + hudH * 0.13} text={balance.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0xffffff }} />
	<Text anchor={0.5} x={screen.width * 0.3} y={hy - hudH * 0.13} text="WIN" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }} />
	<Text anchor={0.5} x={screen.width * 0.3} y={hy + hudH * 0.13} text={lastWin.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0x12d36a }} />

	<!-- DEBUG: force feature -->
	<Container eventMode="static" cursor="pointer" onpointertap={() => triggerFeatureNext()}>
		<Rectangle anchor={0.5} x={screen.width * 0.55} y={hy} width={Math.min(screen.width * 0.2, 200)} height={hudH * 0.5} backgroundColor={0x3a1020} borderColor={0xc5495f} borderWidth={2} borderRadius={12} />
		<Text anchor={0.5} x={screen.width * 0.55} y={hy} text="FORCE FEATURE" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.12, fontWeight: '800', fill: 0xffd0d8 }} />
	</Container>

	<!-- SPIN -->
	<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
		<Rectangle anchor={0.5} x={screen.width * 0.88} y={hy} width={Math.min(screen.width * 0.18, 180)} height={hudH * 0.66} backgroundColor={busy ? 0x0c5a2a : 0x12a84a} borderColor={0xf3c64c} borderWidth={3} borderRadius={18} />
		<Text anchor={0.5} x={screen.width * 0.88} y={hy} text={busy ? '…' : 'SPIN'} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.2, fontWeight: '900', fill: 0xffffff }} />
	</Container>
{/if}

<!-- debug overlay -->
{#if debug}
	<Rectangle anchor={{ x: 0, y: 0 }} x={6} y={6} width={Math.min(screen.width * 0.5, 430)} height={64} backgroundColor={0x000000} backgroundAlpha={0.5} borderRadius={8} />
	<Text anchor={{ x: 0, y: 0 }} x={14} y={12} text={`STATE: ${phase}    feature:${featureActive}    respins:${respinsLeft}`} style={{ fontFamily: 'monospace', fontSize: 15, fill: PHASE_COLOR[phase] }} />
	<Text anchor={{ x: 0, y: 0 }} x={14} y={36} text={`coinsLocked:${coinsLocked}  featWin:${totalFeatureWin}x  assets:${assetCount}  last:${lastSpinResult}`} style={{ fontFamily: 'monospace', fontSize: 13, fill: 0x9fe0b0 }} />
{/if}
