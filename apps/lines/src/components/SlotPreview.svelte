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
		rollReveal,
		coinKey,
		adjacent,
		type Sym,
		type Reveal,
	} from '../game/goldenGoalEngine';

	type Props = { showHud?: boolean; debug?: boolean; view?: string };
	const { showHud = true, debug = true, view = 'slot' }: Props = $props();

	const app = getContextApp();
	const screen = $derived(app.stateApp.pixiApplication?.screen ?? { width: 1280, height: 720 });
	const assetCount = $derived(Object.keys(app.stateApp.loadedAssets ?? {}).length);

	type Cell = {
		type: Sym;
		golden: boolean;
		reveal?: Reveal;
		drop: Tween<number>;
		pulse: Tween<number>;
	};
	const mkCell = (type: Sym, golden = false): Cell => ({
		type,
		golden,
		reveal: undefined,
		drop: new Tween(0, { duration: 340, easing: backOut }),
		pulse: new Tween(1, { duration: 150, easing: cubicOut }),
	});
	const golden = new Set<string>(); // golden tile positions (must exist before board init)
	const fromGrid = (grid: Sym[][]): Cell[][] =>
		grid.map((col, c) => col.map((t, r) => mkCell(t, golden.has(`${c}:${r}`))));

	// ---- state ----
	type Phase =
		| 'idle' | 'spinStarting' | 'reelsDropping' | 'evaluating' | 'winHighlight'
		| 'cascadeRemoving' | 'cascadeDropping' | 'goldenTilesMarking' | 'goldenTilesReveal'
		| 'featureTrigger' | 'featurePlaying' | 'featureOutro';

	let board = $state<Cell[][]>(fromGrid(makeGrid()));
	let phase = $state<Phase>('idle');
	let boardValid = $state(true);
	let filledCells = $state(REELS * ROWS);
	let rainbowPresent = $state(false);
	let featureActive = $state(false);
	let featureName = $state('');
	let freeSpinsLeft = $state(0);
	let totalCoinMultiplier = $state(0);
	let lastFeatureWin = $state(0);
	let lastWin = $state(0);
	let balance = $state(1000);
	let busy = $state(false);
	let forceFeature = $state(false);
	let forceRainbow = $state(false);
	let fsMode5 = $state(false);
	const bet = 1;

	const goldenCount = $derived(board.flat().filter((c) => c.golden).length);

	const round2 = (n: number) => Math.round(n * 100) / 100;
	const grid = (): Sym[][] => board.map((col) => col.map((c) => c.type));
	const cellOf = (k: string) => {
		const [c, r] = k.split(':').map(Number);
		return board[c][r];
	};
	const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

	function validate() {
		const v = validateGrid(grid());
		boardValid = v.valid;
		filledCells = v.filled;
		if (!v.valid) console.error('[SlotPreview] board invalid:', v.reason);
	}

	// ---- layout ----
	const hudH = $derived(showHud ? Math.min(screen.height * 0.15, 130) : 0);
	const logoH = $derived(Math.min(screen.height * 0.14, 130));
	const areaTop = $derived(logoH * 0.9);
	const areaH = $derived(screen.height - areaTop - hudH - screen.height * 0.03);
	const areaW = $derived(screen.width * 0.96);
	const SZ = $derived(Math.max(34, Math.min(areaW / REELS, areaH / ROWS)));
	const boardW = $derived(SZ * REELS);
	const boardH = $derived(SZ * ROWS);
	const cx = $derived(screen.width / 2);
	const boardLeft = $derived(cx - boardW / 2);
	const boardTop = $derived(areaTop + (areaH - boardH) / 2);
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
	const logoW = $derived(Math.min(screen.width * 0.38, 520));

	const pop = (c?: Cell, to = 1.3) => {
		if (!c) return;
		c.pulse.set(to, { duration: 110 }).then(() => c.pulse.set(1, { duration: 200 }));
	};

	// ---- rendering helpers ----
	function spriteKey(c: Cell): string {
		if (c.reveal) {
			if (c.reveal.kind === 'coin') return coinKey(c.reveal.value);
			if (c.reveal.kind === 'booster') return 'symbolMultiplier';
			return 'symbolCollector';
		}
		if (c.type === 'RAINBOW') return 'symbolRainbow';
		if (c.type === 'S') return 'ggr-s';
		if (c.type === 'W') return 'ggr-w';
		return `ggr-${c.type.toLowerCase()}`;
	}
	function label(c: Cell): string {
		if (!c.reveal) return '';
		if (c.reveal.kind === 'coin') return `${c.reveal.value}x`;
		if (c.reveal.kind === 'booster') return `x${c.reveal.mult}`;
		return '';
	}

	// ---- drop a fresh board (staggered reels) ----
	async function dropNewBoard(opts: { scatter?: number; rainbow?: number } = {}) {
		const g = makeGrid(Math.random, opts);
		const next = fromGrid(g);
		for (let c = 0; c < REELS; c++) {
			board[c] = next[c];
			next[c].forEach((cell, r) => {
				cell.drop.set(ROWS + 1.5 - r, { duration: 0 });
				cell.drop.set(0, { duration: 360 + r * 26, easing: backOut });
			});
			await sleep(95); // staggered column stop (reel 1 first .. reel 6 last)
		}
		await sleep(420);
	}

	function markGolden(clusters: { cells: { reel: number; row: number }[] }[]) {
		for (const cl of clusters)
			for (const p of cl.cells) {
				golden.add(`${p.reel}:${p.row}`);
				board[p.reel][p.row].golden = true;
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
			const cellsCount = cl.reduce((s, c) => s + c.cells.length, 0);
			lastWin = round2(lastWin + bet * cellsCount * 0.25);
			markGolden(cl);
			await sleep(420);

			phase = 'cascadeRemoving';
			const removed = new Set<string>();
			cl.forEach((c) => c.cells.forEach((p) => removed.add(`${p.reel}:${p.row}`)));
			removed.forEach((k) => pop(cellOf(k), 0.2));
			await sleep(260);

			phase = 'cascadeDropping';
			for (let c = 0; c < REELS; c++) {
				const survivors: Cell[] = [];
				for (let r = 0; r < ROWS; r++) if (!removed.has(`${c}:${r}`)) survivors.push(board[c][r]);
				const newCount = ROWS - survivors.length;
				const fresh = Array.from({ length: newCount }, () => mkCell(makeGrid()[0][0]));
				const col = [...fresh, ...survivors];
				col.forEach((cell, r) => {
					cell.golden = golden.has(`${c}:${r}`); // golden is positional
					cell.drop.set(0, { duration: 0 });
				});
				fresh.forEach((cell, i) => {
					cell.drop.set(ROWS + 1 - i, { duration: 0 });
					cell.drop.set(0, { duration: 320, easing: backOut });
				});
				board[c] = col;
			}
			await sleep(380);
			validate();
			phase = 'evaluating';
			cl = findClusters(grid());
		}
	}

	const hasRainbow = () => board.flat().some((c) => c.type === 'RAINBOW');
	const countScatter = () => board.flat().filter((c) => c.type === 'S').length;
	const sumCoins = () =>
		round2(
			board
				.flat()
				.filter((c) => c.reveal?.kind === 'coin')
				.reduce((s, c) => s + (c.reveal as any).value, 0),
		);

	function pickEmptyNonGolden(n: number): string[] {
		const free: string[] = [];
		for (let c = 0; c < REELS; c++)
			for (let r = 0; r < ROWS; r++) if (!board[c][r].golden) free.push(`${c}:${r}`);
		for (let i = free.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[free[i], free[j]] = [free[j], free[i]];
		}
		return free.slice(0, n);
	}

	function applyBoosters() {
		const boosters = board.flat().map((c, i) => ({ c, i })).filter(({ c }) => c.reveal?.kind === 'booster');
		for (let c = 0; c < REELS; c++)
			for (let r = 0; r < ROWS; r++) {
				const cell = board[c][r];
				if (cell.reveal?.kind !== 'booster') continue;
				const mult = cell.reveal.mult;
				adjacent({ reel: c, row: r }).forEach((p) => {
					const nb = board[p.reel][p.row];
					if (nb.reveal?.kind === 'coin') {
						nb.reveal = { ...nb.reveal, value: round2(nb.reveal.value * mult) };
						pop(nb, 1.35);
					}
				});
				pop(cell, 1.3);
			}
	}

	async function revealFeature(opts: { free?: boolean } = {}) {
		phase = 'goldenTilesReveal';
		board.flat().forEach((c) => c.type === 'RAINBOW' && pop(c, 1.4));
		await sleep(350);

		let round = 0;
		let queue = [...golden].filter((k) => !cellOf(k).reveal);
		while (queue.length && round < 4) {
			round++;
			for (const k of queue) {
				const cell = cellOf(k);
				if (cell.reveal) continue;
				cell.reveal = rollReveal(Math.random, { goldBoost: opts.free, noBronze: opts.free && fsMode5 });
				pop(cell, 1.3);
				await sleep(80);
			}
			await sleep(220);
			applyBoosters();
			await sleep(320);

			const collectors = queue.filter((k) => cellOf(k).reveal?.kind === 'collector');
			if (collectors.length && round < 3) {
				collectors.forEach((k) => pop(cellOf(k), 1.4));
				// Trophy Collector triggers a further reveal round on new golden tiles
				const fresh = pickEmptyNonGolden(4);
				fresh.forEach((k) => {
					golden.add(k);
					cellOf(k).golden = true;
				});
				await sleep(260);
				queue = fresh;
			} else {
				queue = [];
			}
		}

		const coinMult = sumCoins();
		totalCoinMultiplier = round2(totalCoinMultiplier + coinMult);
		const add = round2(bet * coinMult);
		lastWin = round2(lastWin + add);
		lastFeatureWin = round2(lastFeatureWin + add);
		await sleep(300);
	}

	function clearReveals() {
		board.flat().forEach((c) => (c.reveal = undefined));
	}

	async function playSpin(opts: { free?: boolean } = {}) {
		clearReveals();
		phase = 'reelsDropping';
		await dropNewBoard({
			scatter: opts.free ? 0.015 : 0.04,
			rainbow: opts.free ? 0.22 : 0.06,
		});
		validate();
		await cascadeLoop();
		phase = 'goldenTilesMarking';
		await sleep(220);
		rainbowPresent = hasRainbow();
		if ((rainbowPresent || forceRainbow) && golden.size > 0) {
			forceRainbow = false;
			await revealFeature(opts);
		}
	}

	async function runFreeSpins(scatters: number) {
		const fs = scatters >= 5 ? 12 : scatters >= 4 ? 12 : 8;
		featureName =
			scatters >= 5 ? 'End of the Rainbow Goal' : scatters >= 4 ? 'All Goals Turn Gold' : 'Kickoff Bonus';
		fsMode5 = scatters >= 5;
		featureActive = true;
		freeSpinsLeft = fs;
		phase = 'featureTrigger';
		await sleep(1200);

		let guard = 0;
		while (freeSpinsLeft > 0 && guard < 30) {
			guard++;
			phase = 'featurePlaying';
			await playSpin({ free: true }); // golden tiles persist across free spins
			freeSpinsLeft -= 1;
			await sleep(300);
		}
		phase = 'featureOutro';
		await sleep(1400);
		featureActive = false;
		golden.clear();
		board.flat().forEach((c) => (c.golden = false));
		clearReveals();
	}

	async function spin() {
		if (busy) return;
		busy = true;
		phase = 'spinStarting';
		lastWin = 0;
		lastFeatureWin = 0;
		totalCoinMultiplier = 0;
		golden.clear();
		board.flat().forEach((c) => (c.golden = false));
		balance = round2(balance - bet);
		await sleep(120);

		await playSpin({ free: false });

		const sc = countScatter();
		if (forceFeature || sc >= 3) {
			forceFeature = false;
			await runFreeSpins(sc >= 3 ? sc : 3);
		}

		balance = round2(balance + lastWin);
		phase = 'idle';
		busy = false;
	}

	async function forceFeatureRun() {
		if (busy) return;
		busy = true;
		phase = 'spinStarting';
		lastWin = 0;
		lastFeatureWin = 0;
		totalCoinMultiplier = 0;
		golden.clear();
		board.flat().forEach((c) => (c.golden = false));
		balance = round2(balance - bet);
		await playSpin({ free: false });
		// guarantee golden tiles + rainbow for a quick visible feature
		const picks = pickEmptyNonGolden(10);
		picks.forEach((k) => {
			golden.add(k);
			cellOf(k).golden = true;
			pop(cellOf(k), 1.2);
		});
		phase = 'goldenTilesMarking';
		await sleep(450);
		rainbowPresent = true;
		await revealFeature({ free: false });
		phase = 'featureOutro';
		await sleep(1200);
		balance = round2(balance + lastWin);
		golden.clear();
		board.flat().forEach((c) => (c.golden = false));
		phase = 'idle';
		busy = false;
	}

	function resetBoard() {
		if (busy) return;
		golden.clear();
		board = fromGrid(makeGrid());
		board.flat().forEach((c) => c.drop.set(0, { duration: 0 }));
		phase = 'idle';
		lastWin = 0;
		lastFeatureWin = 0;
		totalCoinMultiplier = 0;
		validate();
	}

	onMount(() => {
		board.flat().forEach((c) => c.drop.set(0, { duration: 0 }));
		validate();
	});

	const PHASE_COLOR: Record<string, number> = {
		idle: 0x8fb0d8,
		spinStarting: 0xffd447,
		reelsDropping: 0xffd447,
		evaluating: 0x7ad0ff,
		winHighlight: 0x12d36a,
		cascadeRemoving: 0xff6a6a,
		cascadeDropping: 0x7ad0ff,
		goldenTilesMarking: 0xf4d276,
		goldenTilesReveal: 0xffb04d,
		featureTrigger: 0xff8a3d,
		featurePlaying: 0x12d36a,
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
	width={boardW + SZ * 0.36}
	height={boardH + SZ * 0.36}
	backgroundColor={0x06101f}
	backgroundAlpha={featureActive ? 0.92 : 0.8}
	borderColor={featureActive ? 0xff9a3d : 0xf3c64c}
	borderWidth={Math.max(4, SZ * 0.06)}
	borderRadius={20}
/>

<!-- grid -->
{#each board as col, c}
	{#each col as cell, r}
		{@const px = cellCx(c)}
		{@const py = cellCy(r) - SZ * cell.drop.current}
		<!-- tile bg + golden marker -->
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
		<Sprite
			key={spriteKey(cell)}
			anchor={0.5}
			x={px}
			y={py}
			width={SZ * 0.84 * cell.pulse.current}
			height={SZ * 0.84 * cell.pulse.current}
		/>
		{#if label(cell)}
			<Text
				anchor={0.5}
				x={px}
				y={py + SZ * 0.28}
				text={label(cell)}
				style={{ fontFamily: 'proxima-nova', fontSize: SZ * 0.22, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x000000, width: 4 } }}
			/>
		{/if}
	{/each}
{/each}

<!-- feature banner -->
{#if phase === 'featureTrigger' || phase === 'featureOutro'}
	<Rectangle anchor={0.5} x={cx} y={screen.height * 0.5} width={screen.width * 0.74} height={screen.height * 0.17} backgroundColor={0x1a0a02} backgroundAlpha={0.9} borderColor={0xffb04d} borderWidth={4} borderRadius={20} />
	<Text anchor={0.5} x={cx} y={screen.height * 0.47} text={phase === 'featureTrigger' ? `⚽ ${featureName}` : 'GOLDEN GOAL WIN'} style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.055, fontWeight: '900', fill: 0xffd447 }} />
	<Text anchor={0.5} x={cx} y={screen.height * 0.55} text={phase === 'featureTrigger' ? `${freeSpinsLeft} FREE SPINS` : `${totalCoinMultiplier}x  =  ${lastFeatureWin.toFixed(2)}`} style={{ fontFamily: 'proxima-nova', fontSize: screen.height * 0.045, fontWeight: '800', fill: 0xffffff }} />
{/if}

<!-- HUD -->
{#if showHud}
	{@const hy = screen.height - hudH / 2}
	<Rectangle anchor={{ x: 0, y: 0.5 }} x={0} y={hy} width={screen.width} height={hudH * 0.84} backgroundColor={0x070d1a} backgroundAlpha={0.92} borderColor={0xf3c64c} borderWidth={3} borderRadius={16} />
	<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.02} y={hy - hudH * 0.13} text="BALANCE" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.12, fontWeight: '700', fill: 0x8fb0d8 }} />
	<Text anchor={{ x: 0, y: 0.5 }} x={screen.width * 0.02} y={hy + hudH * 0.13} text={balance.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.18, fontWeight: '900', fill: 0xffffff }} />
	<Text anchor={0.5} x={screen.width * 0.27} y={hy - hudH * 0.13} text="WIN" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.12, fontWeight: '700', fill: 0x8fb0d8 }} />
	<Text anchor={0.5} x={screen.width * 0.27} y={hy + hudH * 0.13} text={lastWin.toFixed(2)} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.18, fontWeight: '900', fill: 0x12d36a }} />

	<Container eventMode="static" cursor="pointer" onpointertap={() => forceFeatureRun()}>
		<Rectangle anchor={0.5} x={screen.width * 0.45} y={hy} width={Math.min(screen.width * 0.17, 180)} height={hudH * 0.5} backgroundColor={0x3a1020} borderColor={0xc5495f} borderWidth={2} borderRadius={12} />
		<Text anchor={0.5} x={screen.width * 0.45} y={hy} text="FORCE FEATURE" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.1, fontWeight: '800', fill: 0xffd0d8 }} />
	</Container>

	<Container eventMode="static" cursor="pointer" onpointertap={() => { forceRainbow = true; spin(); }}>
		<Rectangle anchor={0.5} x={screen.width * 0.63} y={hy} width={Math.min(screen.width * 0.15, 160)} height={hudH * 0.5} backgroundColor={0x102a3a} borderColor={0x4dbdff} borderWidth={2} borderRadius={12} />
		<Text anchor={0.5} x={screen.width * 0.63} y={hy} text="RAINBOW SPIN" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.1, fontWeight: '800', fill: 0xcdebff }} />
	</Container>

	<Container eventMode="static" cursor="pointer" onpointertap={() => resetBoard()}>
		<Rectangle anchor={0.5} x={screen.width * 0.77} y={hy} width={Math.min(screen.width * 0.09, 96)} height={hudH * 0.5} backgroundColor={0x10203a} borderColor={0x2a4a78} borderWidth={2} borderRadius={12} />
		<Text anchor={0.5} x={screen.width * 0.77} y={hy} text="RESET" style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.1, fontWeight: '800', fill: 0xffffff }} />
	</Container>

	<Container eventMode="static" cursor="pointer" onpointertap={() => spin()}>
		<Rectangle anchor={0.5} x={screen.width * 0.9} y={hy} width={Math.min(screen.width * 0.15, 160)} height={hudH * 0.66} backgroundColor={busy ? 0x0c5a2a : 0x12a84a} borderColor={0xf3c64c} borderWidth={3} borderRadius={18} />
		<Text anchor={0.5} x={screen.width * 0.9} y={hy} text={busy ? '…' : 'SPIN'} style={{ fontFamily: 'proxima-nova', fontSize: hudH * 0.18, fontWeight: '900', fill: 0xffffff }} />
	</Container>
{/if}

<!-- debug overlay -->
{#if debug}
	<Rectangle anchor={{ x: 0, y: 0 }} x={6} y={6} width={Math.min(screen.width * 0.62, 520)} height={70} backgroundColor={0x000000} backgroundAlpha={0.55} borderRadius={8} />
	<Text anchor={{ x: 0, y: 0 }} x={12} y={11} text={`state:${phase}  boardValid:${boardValid}  filled:${filledCells}/30  rainbow:${rainbowPresent}`} style={{ fontFamily: 'monospace', fontSize: 14, fill: PHASE_COLOR[phase] ?? 0xffffff }} />
	<Text anchor={{ x: 0, y: 0 }} x={12} y={36} text={`golden:${goldenCount}  feature:${featureActive}  fs:${freeSpinsLeft}  coinX:${totalCoinMultiplier}  featWin:${lastFeatureWin}`} style={{ fontFamily: 'monospace', fontSize: 13, fill: 0x9fe0b0 }} />
{/if}
