<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';
	import { Container, Rectangle, Sprite, Text, getContextApp } from 'pixi-svelte';

	import {
		REELS,
		ROWS,
		makeGrid,
		findClusters,
		validateGrid,
		coinKey,
		COIN_TIERS,
		BOOSTER_MULTS,
		adjacent,
		type Sym,
	} from '../game/goldenGoalEngine';

	type Props = { showHud?: boolean; debug?: boolean; view?: string };
	const { showHud = true, debug = true, view = 'slot' }: Props = $props();

	const app = getContextApp();
	const screen = $derived(app.stateApp.pixiApplication?.screen ?? { width: 1280, height: 720 });
	const assetCount = $derived(Object.keys(app.stateApp.loadedAssets ?? {}).length);

	type RevealKind = 'coin' | 'booster' | 'collector';
	type Cell = {
		type: Sym;
		golden: boolean;
		revealKind?: RevealKind;
		coinValue: number;
		coinTier: string;
		boosterMult: number;
		drop: Tween<number>;
		pulse: Tween<number>;
	};
	const golden = new Set<string>(); // golden tile positions (declare before board init!)
	const mkCell = (type: Sym, isGolden = false): Cell => ({
		type,
		golden: isGolden,
		revealKind: undefined,
		coinValue: 0,
		coinTier: '',
		boosterMult: 0,
		drop: new Tween(0, { duration: 340, easing: backOut }),
		pulse: new Tween(1, { duration: 150, easing: cubicOut }),
	});

	// use generated asset-sheet symbol if loaded, else fall back to the placeholder key
	const isLoaded = (k: string) => Boolean(app.stateApp.loadedAssets?.[k]);
	const keyOr = (primary: string, fallback: string) => (isLoaded(primary) ? primary : fallback);
	const fromGrid = (grid: Sym[][]): Cell[][] =>
		grid.map((col, c) => col.map((t, r) => mkCell(t, golden.has(`${c}:${r}`))));

	// ---- state ----
	type Phase =
		| 'idle' | 'spinStarting' | 'reelsDropping' | 'evaluating' | 'winHighlight'
		| 'goldenTilesMarking' | 'cascadeRemoving' | 'cascadeDropping' | 'rainbowActivation'
		| 'goldenTilesReveal' | 'boosterResolve' | 'collectorResolve' | 'featureWinCountUp' | 'featureOutro';

	let tab = $state<'slot' | 'symbols'>(view === 'symbols' ? 'symbols' : 'slot');
	let board = $state<Cell[][]>(fromGrid(makeGrid()));
	let phase = $state<Phase>('idle');
	let boardValid = $state(true);
	let filledCells = $state(REELS * ROWS);
	let rainbowPresent = $state(false);
	let featureActive = $state(false);
	let revealedCoins = $state(0);
	let clusterWins = $state(0);
	let boosterCount = $state(0);
	let collectorValue = $state(0);
	let totalCoinMultiplier = $state(0);
	let featureWin = $state(0);
	let countWin = $state(0);
	let lastWin = $state(0);
	let balance = $state(1000);
	let busy = $state(false);
	let lastError = $state('—');
	const bet = 1;

	const goldenCount = $derived(board.flat().filter((c) => c.golden).length);

	const round2 = (n: number) => Math.round(n * 100) / 100;
	const grid = (): Sym[][] => board.map((col) => col.map((c) => c.type));
	const cellOf = (k: string) => {
		const [c, r] = k.split(':').map(Number);
		return board[c][r];
	};
	const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
	const ri = (n: number) => Math.floor(Math.random() * n);
	const pickArr = <T,>(a: readonly T[]) => a[ri(a.length)];

	function validate() {
		const v = validateGrid(grid());
		boardValid = v.valid;
		filledCells = v.filled;
		if (!v.valid) {
			lastError = `board invalid: ${v.reason}`;
			console.error('[SlotPreview]', lastError);
		}
	}

	// ---- layout ----
	const hudH = $derived(showHud ? Math.min(screen.height * 0.14, 120) : 0);
	const topH = $derived(Math.min(screen.height * 0.13, 116)); // logo + tabs
	const areaH = $derived(screen.height - topH - hudH - screen.height * 0.03);
	const areaW = $derived(screen.width * 0.96);
	const SZ = $derived(Math.max(34, Math.min(areaW / REELS, areaH / ROWS)));
	const boardW = $derived(SZ * REELS);
	const boardH = $derived(SZ * ROWS);
	const cx = $derived(screen.width / 2);
	const boardLeft = $derived(cx - boardW / 2);
	const boardTop = $derived(topH + (areaH - boardH) / 2);
	const cellCx = (c: number) => boardLeft + c * SZ + SZ / 2;
	const cellCy = (r: number) => boardTop + r * SZ + SZ / 2;

	const bgRatio = 1672 / 941;
	const cover = $derived.by(() => {
		const r = screen.width / screen.height;
		return r > bgRatio
			? { width: screen.width, height: screen.width / bgRatio }
			: { width: screen.height * bgRatio, height: screen.height };
	});
	const logoRatio = 1047 / 1516;
	const logoW = $derived(Math.min(screen.width * 0.32, 460));

	const pop = (c?: Cell, to = 1.3) => {
		if (!c) return;
		c.pulse.set(to, { duration: 110 }).then(() => c.pulse.set(1, { duration: 200 }));
	};

	// ---- rendering helpers ----
	function spriteKey(c: Cell): string {
		if (c.revealKind === 'coin') return keyOr(`ggr-coin-${c.coinTier || 'bronze'}`, coinKey(c.coinValue));
		if (c.revealKind === 'booster') return keyOr('ggr-goal-booster', 'symbolMultiplier');
		if (c.revealKind === 'collector') return keyOr('ggr-trophy-collector', 'symbolCollector');
		if (c.type === 'RAINBOW') return keyOr('ggr-rainbow-goal', 'symbolRainbow');
		if (c.type === 'S') return keyOr('ggr-scatter-badge', 'ggr-s');
		if (c.type === 'W') return keyOr('ggr-wild-badge', 'ggr-w');
		return `ggr-${c.type.toLowerCase()}`;
	}
	function label(c: Cell): string {
		if (c.revealKind === 'coin') return `${c.coinValue}x`;
		if (c.revealKind === 'booster') return `x${c.boosterMult}`;
		return '';
	}

	// ---- core helpers ----
	async function dropNewBoard(opts: { scatter?: number; rainbow?: number } = {}) {
		const g = makeGrid(Math.random, opts);
		const next = fromGrid(g);
		for (let c = 0; c < REELS; c++) {
			board[c] = next[c];
			next[c].forEach((cell, r) => {
				cell.drop.set(ROWS + 1.5 - r, { duration: 0 });
				cell.drop.set(0, { duration: 360 + r * 26, easing: backOut });
			});
			await sleep(95);
		}
		await sleep(400);
	}

	function markGolden(clusters: { cells: { reel: number; row: number }[] }[]) {
		for (const cl of clusters)
			for (const p of cl.cells) {
				golden.add(`${p.reel}:${p.row}`);
				board[p.reel][p.row].golden = true;
				pop(board[p.reel][p.row], 1.18);
			}
	}

	async function cascadeLoop() {
		let safe = 0;
		phase = 'evaluating';
		let cl = findClusters(grid());
		while (cl.length && safe < 12) {
			safe++;
			phase = 'winHighlight';
			cl.forEach((c) => c.cells.forEach((p) => pop(board[p.reel][p.row], 1.22)));
			clusterWins += cl.length;
			lastWin = round2(lastWin + bet * cl.reduce((s, c) => s + c.cells.length, 0) * 0.2);
			await sleep(380);
			phase = 'goldenTilesMarking';
			markGolden(cl);
			await sleep(260);

			phase = 'cascadeRemoving';
			const removed = new Set<string>();
			cl.forEach((c) => c.cells.forEach((p) => removed.add(`${p.reel}:${p.row}`)));
			removed.forEach((k) => pop(cellOf(k), 0.2));
			await sleep(240);

			phase = 'cascadeDropping';
			for (let c = 0; c < REELS; c++) {
				const survivors: Cell[] = [];
				for (let r = 0; r < ROWS; r++) if (!removed.has(`${c}:${r}`)) survivors.push(board[c][r]);
				const newCount = ROWS - survivors.length;
				const fresh = Array.from({ length: newCount }, () => mkCell(makeGrid()[0][0]));
				const col = [...fresh, ...survivors];
				col.forEach((cell, r) => {
					cell.golden = golden.has(`${c}:${r}`);
					cell.drop.set(0, { duration: 0 });
				});
				fresh.forEach((cell, i) => {
					cell.drop.set(ROWS + 1 - i, { duration: 0 });
					cell.drop.set(0, { duration: 320, easing: backOut });
				});
				board[c] = col;
			}
			await sleep(360);
			validate();
			phase = 'evaluating';
			cl = findClusters(grid());
		}
	}

	const hasRainbow = () => board.flat().some((c) => c.type === 'RAINBOW');
	const countScatter = () => board.flat().filter((c) => c.type === 'S').length;

	function pickEmptyNonGolden(n: number): string[] {
		const free: string[] = [];
		for (let c = 0; c < REELS; c++)
			for (let r = 0; r < ROWS; r++) if (!board[c][r].golden) free.push(`${c}:${r}`);
		for (let i = free.length - 1; i > 0; i--) {
			const j = ri(i + 1);
			[free[i], free[j]] = [free[j], free[i]];
		}
		return free.slice(0, n);
	}

	// reveal one tile; coinHeavy biases toward coins so force feature always pays
	function revealTile(cell: Cell, opts: { coinHeavy?: boolean; goldBoost?: boolean } = {}) {
		const r = Math.random();
		const collectorChance = opts.coinHeavy ? 0.06 : 0.1;
		const boosterChance = opts.coinHeavy ? 0.12 : 0.12;
		if (r < collectorChance) {
			cell.revealKind = 'collector';
		} else if (r < collectorChance + boosterChance) {
			cell.revealKind = 'booster';
			cell.boosterMult = pickArr(BOOSTER_MULTS);
		} else {
			cell.revealKind = 'coin';
			const cr = Math.random();
			const tier = opts.goldBoost && cr > 0.7 ? 'gold' : cr < 0.62 ? 'bronze' : cr < 0.9 ? 'silver' : 'gold';
			cell.coinTier = tier;
			cell.coinValue = pickArr(COIN_TIERS[tier]);
		}
		pop(cell, 1.32);
	}

	function applyBoosters() {
		for (let c = 0; c < REELS; c++)
			for (let r = 0; r < ROWS; r++) {
				const cell = board[c][r];
				if (cell.revealKind !== 'booster') continue;
				adjacent({ reel: c, row: r }).forEach((p) => {
					const nb = board[p.reel][p.row];
					if (nb.revealKind === 'coin') {
						nb.coinValue = round2(Math.min(nb.coinValue * cell.boosterMult, 1000));
						pop(nb, 1.4);
					}
				});
				pop(cell, 1.35);
			}
	}

	const coinSum = () =>
		round2(board.flat().reduce((s, c) => s + (c.revealKind === 'coin' ? c.coinValue : 0), 0));
	const coinCount = () => board.flat().filter((c) => c.revealKind === 'coin').length;

	async function revealFeature(opts: { coinHeavy?: boolean; goldBoost?: boolean } = {}) {
		phase = 'rainbowActivation';
		board.flat().forEach((c) => c.type === 'RAINBOW' && pop(c, 1.45));
		await sleep(420);

		phase = 'goldenTilesReveal';
		let round = 0;
		let queue = [...golden].filter((k) => !cellOf(k).revealKind);
		while (queue.length && round < 4) {
			round++;
			for (const k of queue) {
				const cell = cellOf(k);
				if (cell.revealKind) continue;
				revealTile(cell, opts);
				await sleep(90); // 80-120ms tile flip chain
			}
			await sleep(220);

			phase = 'boosterResolve';
			applyBoosters();
			await sleep(360);

			const collectors = queue.filter((k) => cellOf(k).revealKind === 'collector');
			if (collectors.length && round < 3) {
				phase = 'collectorResolve';
				collectors.forEach((k) => pop(cellOf(k), 1.5));
				const fresh = pickEmptyNonGolden(4);
				fresh.forEach((k) => {
					golden.add(k);
					cellOf(k).golden = true;
					pop(cellOf(k), 1.15);
				});
				await sleep(360);
				phase = 'goldenTilesReveal';
				queue = fresh;
			} else {
				queue = [];
			}
		}

		revealedCoins = coinCount();
		boosterCount = board.flat().filter((c) => c.revealKind === 'booster').length;
		totalCoinMultiplier = coinSum();
		collectorValue = totalCoinMultiplier;
		featureWin = round2(bet * totalCoinMultiplier);
	}

	function clearReveals() {
		board.flat().forEach((c) => {
			c.revealKind = undefined;
			c.coinValue = 0;
			c.boosterMult = 0;
		});
	}

	async function countUp(target: number) {
		phase = 'featureWinCountUp';
		const steps = 24;
		for (let i = 1; i <= steps; i++) {
			countWin = round2((target * i) / steps);
			await sleep(40);
		}
		countWin = target;
	}

	// ---- public actions ----
	function resetFeatureStats() {
		lastWin = 0;
		featureWin = 0;
		countWin = 0;
		totalCoinMultiplier = 0;
		revealedCoins = 0;
	}

	function placeRainbow() {
		const c = Math.floor(Math.random() * REELS);
		const r = Math.floor(Math.random() * ROWS);
		board[c][r].type = 'RAINBOW';
		pop(board[c][r], 1.45);
	}

	// after a feature: clear coins/golden so the idle base board shows normal symbols again
	function restoreAfterFeature() {
		const fresh = makeGrid();
		board.forEach((col, reel) =>
			col.forEach((c, row) => {
				if (c.revealKind || c.type === 'RAINBOW') c.type = fresh[reel][row];
				c.revealKind = undefined;
				c.coinValue = 0;
				c.boosterMult = 0;
				c.coinTier = '';
				c.golden = false;
			}),
		);
		golden.clear();
		boosterCount = 0;
		collectorValue = 0;
	}

	async function spin() {
		if (busy) return;
		busy = true;
		lastError = '—';
		try {
			phase = 'spinStarting';
			resetFeatureStats();
			clusterWins = 0;
			golden.clear();
			board.flat().forEach((c) => (c.golden = false));
			clearReveals();
			balance = round2(balance - bet);
			await sleep(110);

			// BASE GAME: only normal symbols drop (no coins, no rainbow yet)
			phase = 'reelsDropping';
			await dropNewBoard({ scatter: 0.03, rainbow: 0 });
			validate();

			// cluster wins -> mark Golden Goal Tiles -> cascade
			await cascadeLoop();

			// RAINBOW CHECK: rare event, only meaningful when Golden Goal Tiles exist
			phase = 'rainbowCheck';
			await sleep(280);
			if (golden.size > 0 && Math.random() < 0.25) placeRainbow();
			rainbowPresent = hasRainbow();

			if (rainbowPresent && golden.size > 0) {
				featureActive = true;
				await revealFeature({});
				if (totalCoinMultiplier > 0) {
					lastWin = round2(lastWin + featureWin);
					await countUp(featureWin);
					phase = 'featureOutro';
					await sleep(1300);
				}
				featureActive = false;
				restoreAfterFeature();
			}

			balance = round2(balance + lastWin);
			phase = 'idle';
		} catch (e) {
			lastError = String((e as Error)?.message ?? e);
			console.error('[SlotPreview] spin error:', e);
			featureActive = false;
			phase = 'idle';
		} finally {
			busy = false;
		}
	}

	// guaranteed visible feature for quick testing
	async function forceFeature(opts: { collector?: boolean } = {}) {
		if (busy) return;
		busy = true;
		lastError = '—';
		try {
			phase = 'spinStarting';
			resetFeatureStats();
			golden.clear();
			board.flat().forEach((c) => (c.golden = false));
			clearReveals();
			balance = round2(balance - bet);
			await dropNewBoard({});
			validate();

			// place a rainbow + a guaranteed set of golden tiles
			const picks = pickEmptyNonGolden(12);
			picks.forEach((k) => {
				golden.add(k);
				cellOf(k).golden = true;
			});
			// drop a rainbow symbol somewhere visible
			board[ri(REELS)][ri(ROWS)].type = 'RAINBOW';
			phase = 'goldenTilesMarking';
			await sleep(450);

			featureActive = true;
			rainbowPresent = true;
			await revealFeature({ coinHeavy: true, goldBoost: true });

			// guarantee a collector path if requested
			if (opts.collector) {
				phase = 'collectorResolve';
				const k = [...golden][0];
				if (k) {
					const cell = cellOf(k);
					cell.revealKind = 'collector';
					pop(cell, 1.5);
				}
				const fresh = pickEmptyNonGolden(4);
				fresh.forEach((fk) => {
					golden.add(fk);
					cellOf(fk).golden = true;
					revealTile(cellOf(fk), { coinHeavy: true, goldBoost: true });
				});
				await sleep(500);
				applyBoosters();
				revealedCoins = coinCount();
				totalCoinMultiplier = coinSum();
				featureWin = round2(bet * totalCoinMultiplier);
			}

			if (totalCoinMultiplier > 0) {
				lastWin = round2(lastWin + featureWin);
				await countUp(featureWin);
				phase = 'featureOutro';
				await sleep(1500);
			}
			featureActive = false;
			balance = round2(balance + lastWin);
			phase = 'idle';
		} catch (e) {
			lastError = String((e as Error)?.message ?? e);
			console.error('[SlotPreview] forceFeature error:', e);
			featureActive = false;
			phase = 'idle';
		} finally {
			busy = false;
		}
	}

	async function forceClusterWin() {
		if (busy) return;
		busy = true;
		lastError = '—';
		try {
			phase = 'spinStarting';
			resetFeatureStats();
			golden.clear();
			board.flat().forEach((c) => (c.golden = false));
			clearReveals();
			balance = round2(balance - bet);
			await dropNewBoard({});
			// stamp a guaranteed cluster of H1 in a 2x3 block
			for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) board[c][r].type = 'H1';
			validate();
			await cascadeLoop();
			balance = round2(balance + lastWin);
			phase = 'idle';
		} catch (e) {
			lastError = String(e);
			phase = 'idle';
		} finally {
			busy = false;
		}
	}

	function resetBoard() {
		if (busy) return;
		golden.clear();
		clearReveals();
		board = fromGrid(makeGrid());
		board.flat().forEach((c) => c.drop.set(0, { duration: 0 }));
		phase = 'idle';
		resetFeatureStats();
		validate();
	}

	onMount(() => {
		board.flat().forEach((c) => c.drop.set(0, { duration: 0 }));
		validate();
	});

	const PHASE_COLOR: Record<string, number> = {
		idle: 0x8fb0d8, spinStarting: 0xffd447, reelsDropping: 0xffd447, evaluating: 0x7ad0ff,
		winHighlight: 0x12d36a, goldenTilesMarking: 0xf4d276, cascadeRemoving: 0xff6a6a,
		cascadeDropping: 0x7ad0ff, rainbowActivation: 0xff8a3d, goldenTilesReveal: 0xffb04d,
		boosterResolve: 0x7ad0ff, collectorResolve: 0xffd447, featureWinCountUp: 0x12d36a,
		featureOutro: 0xf4d276,
	};

	// symbols showcase (only the Symbols tab)
	const SHOWCASE: { k: string; l: string }[] = [
		{ k: 'ggr-h1', l: 'H1 Ball' }, { k: 'ggr-h2', l: 'H2 Trophy' }, { k: 'ggr-h3', l: 'H3 Whistle' },
		{ k: 'ggr-h4', l: 'H4 Shirt' }, { k: 'ggr-wild-badge', l: 'Wild' }, { k: 'ggr-scatter-badge', l: 'Scatter' },
		{ k: 'ggr-l1', l: 'A' }, { k: 'ggr-l2', l: 'K' }, { k: 'ggr-l3', l: 'Q' }, { k: 'ggr-l4', l: 'J' },
		{ k: 'ggr-l5', l: '10' }, { k: 'ggr-rainbow-goal', l: 'Rainbow Goal' },
		{ k: 'ggr-goal-booster', l: 'Goal Booster' }, { k: 'ggr-trophy-collector', l: 'Trophy Collector' },
		{ k: 'ggr-coin-bronze', l: 'Bronze Coin' }, { k: 'ggr-coin-silver', l: 'Silver Coin' },
		{ k: 'ggr-coin-gold', l: 'Gold Coin' },
	];
	const showCols = 4;
	const showSZ = $derived(Math.min(screen.width * 0.2, (screen.height - topH) / 5.5, 160));
</script>

<!-- background (always) -->
<Rectangle x={0} y={0} width={screen.width} height={screen.height} backgroundColor={0x05080f} />
<Sprite key="slotBackground" anchor={0.5} x={cx} y={screen.height / 2} width={cover.width} height={cover.height} />
<Sprite key="logoHorizontal" anchor={0.5} x={cx} y={topH * 0.42} width={logoW} height={logoW * logoRatio} />

<!-- tabs -->
<Container eventMode="static" cursor="pointer" onpointertap={() => (tab = 'slot')}>
	<Rectangle anchor={{ x: 0, y: 0.5 }} x={10} y={topH * 0.42} width={92} height={34} backgroundColor={tab === 'slot' ? 0xf4d276 : 0x10203a} borderColor={0xf3c64c} borderWidth={2} borderRadius={10} />
	<Text anchor={0.5} x={56} y={topH * 0.42} text="SLOT" style={{ fontFamily: 'proxima-nova', fontSize: 16, fontWeight: '900', fill: tab === 'slot' ? 0x15110a : 0xffffff }} />
</Container>
<Container eventMode="static" cursor="pointer" onpointertap={() => (tab = 'symbols')}>
	<Rectangle anchor={{ x: 0, y: 0.5 }} x={110} y={topH * 0.42} width={120} height={34} backgroundColor={tab === 'symbols' ? 0xf4d276 : 0x10203a} borderColor={0xf3c64c} borderWidth={2} borderRadius={10} />
	<Text anchor={0.5} x={170} y={topH * 0.42} text="SYMBOLS" style={{ fontFamily: 'proxima-nova', fontSize: 16, fontWeight: '900', fill: tab === 'symbols' ? 0x15110a : 0xffffff }} />
</Container>

{#if tab === 'symbols'}
	<!-- Symbols showcase ONLY in this tab -->
	{#each SHOWCASE as s, i}
		{@const colI = i % showCols}
		{@const rowI = Math.floor(i / showCols)}
		{@const gx = cx - (showCols * showSZ) / 2 + colI * showSZ + showSZ / 2}
		{@const gy = topH + showSZ * 0.7 + rowI * showSZ}
		<Rectangle anchor={0.5} x={gx} y={gy} width={showSZ * 0.92} height={showSZ * 0.92} backgroundColor={0x0a1730} backgroundAlpha={0.7} borderColor={0x274a7d} borderWidth={2} borderRadius={12} />
		<Sprite key={s.k} anchor={0.5} x={gx} y={gy - showSZ * 0.08} width={showSZ * 0.6} height={showSZ * 0.6} />
		<Text anchor={0.5} x={gx} y={gy + showSZ * 0.34} text={s.l} style={{ fontFamily: 'proxima-nova', fontSize: showSZ * 0.13, fontWeight: '700', fill: 0xffffff }} />
	{/each}
{:else}
	<!-- board frame -->
	<Rectangle
		anchor={0.5}
		x={cx}
		y={boardTop + boardH / 2}
		width={boardW + SZ * 0.36}
		height={boardH + SZ * 0.36}
		backgroundColor={0x06101f}
		backgroundAlpha={featureActive ? 0.92 : 0.8}
		borderColor={featureActive ? 0xff9a3d : 0xf3c64c}
		borderWidth={Math.max(4, SZ * 0.06)}
		borderRadius={20}
	/>

	{#each board as col, c}
		{#each col as cell, r}
			{@const px = cellCx(c)}
			{@const py = cellCy(r) - SZ * cell.drop.current}
			<Rectangle
				anchor={0.5}
				x={px}
				y={cellCy(r)}
				width={SZ * 0.94}
				height={SZ * 0.94}
				backgroundColor={cell.golden ? 0x4a3a08 : (c + r) % 2 === 0 ? 0x0c1a33 : 0x0a1730}
				backgroundAlpha={cell.golden ? 0.85 : 0.6}
				borderColor={cell.golden ? 0xffd447 : 0x274a7d}
				borderWidth={cell.golden ? 3 : 2}
				borderRadius={10}
			/>
			<Sprite key={spriteKey(cell)} anchor={0.5} x={px} y={py} width={SZ * 0.84 * cell.pulse.current} height={SZ * 0.84 * cell.pulse.current} />
			{#if label(cell)}
				<Text anchor={0.5} x={px} y={py + SZ * 0.26} text={label(cell)} style={{ fontFamily: 'proxima-nova', fontSize: SZ * 0.22, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x000000, width: 4 } }} />
			{/if}
		{/each}
	{/each}

	<!-- feature win overlay (ONLY when there is a real win) -->
	{#if (phase === 'featureWinCountUp' || phase === 'featureOutro') && totalCoinMultiplier > 0}
		<Rectangle anchor={0.5} x={cx} y={screen.height * 0.5} width={screen.width * 0.74} height={screen.height * 0.2} backgroundColor={0x1a0a02} backgroundAlpha={0.92} borderColor={0xffb04d} borderWidth={4} borderRadius={20} />
		<Text anchor={0.5} x={cx} y={screen.height * 0.45} text="GOLDEN GOAL WIN" style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.05, fontWeight: '900', fill: 0xffd447 }} />
		<Text anchor={0.5} x={cx} y={screen.height * 0.52} text={`${totalCoinMultiplier}x`} style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.07, fontWeight: '900', fill: 0xffffff }} />
		<Text anchor={0.5} x={cx} y={screen.height * 0.58} text={(phase === 'featureWinCountUp' ? countWin : featureWin).toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.045, fontWeight: '800', fill: 0x12d36a }} />
	{/if}

	<!-- HUD (generated panel + button assets; text rendered in code; rect fallback) -->
	{#if showHud}
		{@const hy = screen.height - hudH / 2}
		{@const btnW = Math.min(screen.width * 0.15, 168)}
		{@const btnH = hudH * 0.74}
		<!-- panel bar: fallback rect + generated panel image on top -->
		<Rectangle anchor={{ x: 0, y: 0.5 }} x={0} y={hy} width={screen.width} height={hudH * 0.86} backgroundColor={0x070d1a} backgroundAlpha={0.92} borderColor={0xf3c64c} borderWidth={3} borderRadius={16} />
		{#if isLoaded('ggr-hud-panel')}
			<Sprite key="ggr-hud-panel" anchor={{ x: 0, y: 0.5 }} x={0} y={hy} width={screen.width} height={hudH * 0.9} />
		{/if}
		<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.03} y={hy - hudH * 0.15} text="BALANCE" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }} />
		<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.03} y={hy + hudH * 0.15} text={balance.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.19, fontWeight: '900', fill: 0xffffff }} />
		<Text anchor={0.5} x={screen.width * 0.22} y={hy - hudH * 0.15} text="BET" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }} />
		<Text anchor={0.5} x={screen.width * 0.22} y={hy + hudH * 0.15} text={bet.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.19, fontWeight: '900', fill: 0xffffff }} />
		<Text anchor={0.5} x={screen.width * 0.33} y={hy - hudH * 0.15} text="WIN" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '700', fill: 0x8fb0d8 }} />
		<Text anchor={0.5} x={screen.width * 0.33} y={hy + hudH * 0.15} text={lastWin.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.19, fontWeight: '900', fill: 0x12d36a }} />

		<!-- BONUS BUY -->
		<Container eventMode="static" cursor="pointer" onpointertap={() => forceFeature({})}>
			{#if isLoaded('ggr-btn-bonus')}
				<Sprite key="ggr-btn-bonus" anchor={0.5} x={screen.width * 0.55} y={hy} width={btnW} height={btnH} />
			{:else}
				<Rectangle anchor={0.5} x={screen.width * 0.55} y={hy} width={btnW} height={btnH * 0.8} backgroundColor={0x3a1020} borderColor={0xc5495f} borderWidth={2} borderRadius={12} />
			{/if}
			<Text anchor={0.5} x={screen.width * 0.55} y={hy} text="BONUS" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '900', fill: 0xffe0a0, stroke: { color: 0x3a0a12, width: 4 } }} />
		</Container>

		<!-- AUTO -->
		<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
			{#if isLoaded('ggr-btn-auto')}
				<Sprite key="ggr-btn-auto" anchor={0.5} x={screen.width * 0.7} y={hy} width={btnW} height={btnH} />
			{:else}
				<Rectangle anchor={0.5} x={screen.width * 0.7} y={hy} width={btnW} height={btnH * 0.8} backgroundColor={0x10203a} borderColor={0x4dbdff} borderWidth={2} borderRadius={12} />
			{/if}
			<Text anchor={0.5} x={screen.width * 0.7} y={hy} text="AUTO" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.13, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x05101f, width: 4 } }} />
		</Container>

		<!-- SPIN -->
		<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
			{#if isLoaded('ggr-btn-spin')}
				<Sprite key="ggr-btn-spin" anchor={0.5} x={screen.width * 0.88} y={hy} width={btnW * 1.1} height={btnH} />
			{:else}
				<Rectangle anchor={0.5} x={screen.width * 0.88} y={hy} width={btnW} height={btnH} backgroundColor={busy ? 0x0c5a2a : 0x12a84a} borderColor={0xf3c64c} borderWidth={3} borderRadius={18} />
			{/if}
			<Text anchor={0.5} x={screen.width * 0.88} y={hy + btnH * 0.34} text={busy ? '...' : 'SPIN'} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.14, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x05140a, width: 4 } }} />
		</Container>
	{/if}

	<!-- small debug buttons row (top) -->
	{#if debug}
		{@const by = topH + 6}
		{@const defs = [
			{ t: 'Cluster', f: () => forceClusterWin() },
			{ t: 'Rainbow', f: () => forceFeature({}) },
			{ t: 'Reveal', f: () => forceFeature({}) },
			{ t: 'Booster', f: () => forceFeature({}) },
			{ t: 'Collector', f: () => forceFeature({ collector: true }) },
			{ t: 'Reset', f: () => resetBoard() },
		]}
		{#each defs as d, i}
			{@const bx = 10 + i * 92}
			<Container eventMode="static" cursor="pointer" onpointertap={d.f}>
				<Rectangle anchor={{ x: 0, y: 0 }} x={bx} y={by} width={86} height={28} backgroundColor={0x161c2e} borderColor={0x3a4a6a} borderWidth={1} borderRadius={8} />
				<Text anchor={0.5} x={bx + 43} y={by + 14} text={d.t} style={{ fontFamily: 'proxima-nova', fontSize: 12, fontWeight: '800', fill: 0xbfe0ff }} />
			</Container>
		{/each}
	{/if}
{/if}

<!-- debug overlay (always, small, top-left under tabs) -->
{#if debug}
	<Rectangle anchor={{ x: 0, y: 0 }} x={6} y={topH + 40} width={Math.min(screen.width * 0.68, 600)} height={86} backgroundColor={0x000000} backgroundAlpha={0.55} borderRadius={8} />
	<Text anchor={{ x: 0, y: 0 }} x={12} y={topH + 45} text={`view:${tab} state:${phase} valid:${boardValid} filled:${filledCells}/30`} style={{ fontFamily: 'monospace', fontSize: 13, fill: PHASE_COLOR[phase] ?? 0xffffff }} />
	<Text anchor={{ x: 0, y: 0 }} x={12} y={topH + 65} text={`clusters:${clusterWins} golden:${goldenCount} rainbow:${rainbowPresent} coins:${revealedCoins} booster:${boosterCount}`} style={{ fontFamily: 'monospace', fontSize: 12, fill: 0x9fe0b0 }} />
	<Text anchor={{ x: 0, y: 0 }} x={12} y={topH + 84} text={`collector:${collectorValue} totalMult:${totalCoinMultiplier}x featWin:${featureWin} err:${lastError}`} style={{ fontFamily: 'monospace', fontSize: 12, fill: 0x9fe0b0 }} />
{/if}
