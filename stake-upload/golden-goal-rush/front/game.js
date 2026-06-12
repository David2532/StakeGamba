import {
	BET,
	COLS,
	COINS,
	MATH_CONFIG,
	MULTIPLIERS,
	ROWS,
	SYMBOLS,
	createMathEngine,
	runFreeSpins,
	runPaidSpin,
	simulateSpins,
} from "../math/math.js";

const assetMap = {
	"10": "../assets/10.png",
	j: "../assets/j.png",
	q: "../assets/q.png",
	k: "../assets/k.png",
	a: "../assets/a.png",
	fussball: "../assets/fussball.png",
	pfeife: "../assets/pfeife.png",
	pokal: "../assets/pokal.png",
	trikot: "../assets/trikot.png",
	wild: "../assets/wild.png",
	scatter: "../assets/scatter.png",
	rainbow: "../assets/special/rainbow.png",
	collector: "../assets/special/collector.png",
	bronzeCoin: "../assets/special/bronze.png",
	silverCoin: "../assets/special/silber.png",
	goldCoin: "../assets/special/gold.png",
	coin_0_2: "../assets/special/0.2x.png",
	coin_0_5: "../assets/special/0.5x.png",
	coin_1: "../assets/special/1x.png",
	coin_2: "../assets/special/2x.png",
	coin_4: "../assets/special/4x.png",
	coin_5: "../assets/special/5x.png",
	coin_10: "../assets/special/10x.png",
	coin_15: "../assets/special/15x.png",
	coin_20: "../assets/special/20x.png",
	coin_25: "../assets/special/25x.png",
	coin_50: "../assets/special/50x.png",
	coin_100: "../assets/special/100x.png",
	coin_250: "../assets/special/250x.png",
	coin_500: "../assets/special/500x.png",
	multi_x2: "../assets/special/x2.png",
	multi_x3: "../assets/special/x3.png",
	multi_x4: "../assets/special/x4.png",
	multi_x5: "../assets/special/x5.png",
	multi_x10: "../assets/special/x10.png",
};

const boardEl = document.querySelector("#board");
const spinButton = document.querySelector("#spin");
const menuButton = document.querySelector("#menu");
const buyBonusButton = document.querySelector("#buy-bonus");
const boostButton = document.querySelector("#boost");
const autoSpinButton = document.querySelector("#auto-spin");
const betUpButton = document.querySelector("#bet-up");
const betDownButton = document.querySelector("#bet-down");
const winEl = document.querySelector("#win");
const balanceEl = document.querySelector("#balance");
const betEl = document.querySelector("#bet");
const spinCounterEl = document.querySelector("#spin-counter");
const modal = document.querySelector("#modal");
const modalTitle = document.querySelector("#modal-title");
const modalText = document.querySelector("#modal-text");
const modalClose = document.querySelector("#modal-close");
const modalCard = document.querySelector(".modal-card");

const math = createMathEngine();
let balance = 1000;
let currentBet = 2;
let turbo = false;
let chanceBoost = false;
let featureSpinMode = null;
let spinning = false;
let freeSpinsPlaying = false;
let currentWin = 0;
let lastBonusTriggered = false;
let freeSpinsLeft = null;
const betSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const autoplayOptions = {
	rounds: 10,
	stopOnBonus: true,
	lossLimit: null,
	singleWinLimit: null,
};

const uiKitPreload = [
	"spin_btn_hover",
	"spin_btn_pressed",
	"spin_btn_disabled",
	"spin_btn_spinning_ring",
	"turbo_btn_active",
	"auto_btn_active",
	"bet_plus_btn_hover",
	"bet_plus_btn_pressed",
	"bet_minus_btn_hover",
	"bet_minus_btn_pressed",
	"bonus_buy_btn_hover",
	"bonus_buy_btn_pressed",
	"bonus_buy_btn_disabled",
	"big_win_ribbon",
	"mega_win_ribbon",
	"epic_win_ribbon",
	"golden_goal_banner",
	"coin_burst_overlay",
];
uiKitPreload.forEach((name) => {
	const img = new Image();
	img.src = `../assets/ui-kit/${name}.png`;
});

const WIN_BANNER_TIERS = [
	{ threshold: 100, image: "epic_win_ribbon" },
	{ threshold: 50, image: "mega_win_ribbon" },
	{ threshold: 20, image: "big_win_ribbon" },
];

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(value) {
	return `$${value.toFixed(2)}`;
}

function playMultiplier() {
	if (featureSpinMode === "strikerBoost") return 3;
	if (featureSpinMode === "rainbowRush") return 50;
	if (chanceBoost) return 2;
	return 1;
}

function playCost() {
	return currentBet * playMultiplier();
}

function updateBetDisplay() {
	betEl.textContent = money(playCost());
	betEl.closest(".bet-panel")?.classList.toggle("feature-active", playMultiplier() > 1);
}

function updateSpinCounter() {
	const active = freeSpinsLeft != null;
	spinCounterEl.hidden = !active;
	spinCounterEl.textContent = active ? `SPINS LEFT: ${freeSpinsLeft}` : "";
}

function key(pos) {
	return `${pos.col}:${pos.row}`;
}

function kind(id) {
	if (id === "rainbow") return "rainbow";
	if (id.startsWith("coin_") || id === "bronzeCoin" || id === "silverCoin" || id === "goldCoin") return "coin";
	if (id.startsWith("multi_")) return "multiplier";
	if (id === "collector") return "collector";
	if (id === "scatter") return "scatter";
	if (id === "wild") return "wild";
	return "regular";
}

function coinIdForValue(value) {
	const normalized = String(value).replace(".", "_");
	return `coin_${normalized}`;
}

function coinValueFromId(id) {
	if (!id.startsWith("coin_")) return null;
	return Number(id.replace("coin_", "").replace("_", "."));
}

function coinVisualIdForValue(value) {
	if (value >= 25) return "goldCoin";
	if (value >= 5) return "silverCoin";
	return "bronzeCoin";
}

function formatCoinValue(value) {
	const rounded = Math.round(value * 10) / 10;
	return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}x`;
}

function ensureBoardCells() {
	if (boardEl.children.length === COLS * ROWS) return;
	boardEl.innerHTML = "";
	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			const cell = document.createElement("div");
			cell.className = "cell";
			cell.dataset.col = col;
			cell.dataset.row = row;
			boardEl.append(cell);
		}
	}
}

function render({ dropping = [], highlight = [], revealCoins = [], multiplied = [], collected = [], pulse = [], overrideSymbols = new Map(), coinValues = new Map() } = {}) {
	const snap = math.snapshot();
	const highlightSet = new Set(highlight.map(key));
	const revealSet = new Set(revealCoins.map(key));
	const multipliedSet = new Set(multiplied.map(key));
	const collectedSet = new Set(collected.map(key));
	const pulseSet = new Set(pulse.map(key));
	const dropMap = new Map(dropping.map((pos) => [key(pos), pos]));

	ensureBoardCells();
	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			const cellKey = `${col}:${row}`;
			const id = overrideSymbols.get(cellKey) ?? snap.board[col][row];
			const coinValue = coinValueFromId(id);
			const displayId = coinValue == null ? id : coinVisualIdForValue(coinValue);
			const cell = boardEl.children[row * COLS + col];

			cell.className = "cell";
			cell.style.removeProperty("--drop-delay");
			cell.style.removeProperty("--drop-speed");
			const drop = dropMap.get(cellKey);
			if (snap.goldenSquares.has(cellKey)) cell.classList.add("gold");
			if (snap.coinedSquares.has(cellKey)) cell.classList.add("coined");
			if (highlightSet.has(cellKey)) cell.classList.add("hit");
			if (multipliedSet.has(cellKey)) cell.classList.add("multiplied");
			if (collectedSet.has(cellKey)) cell.classList.add("collected");
			if (pulseSet.has(cellKey)) cell.classList.add("pulse");
			if (drop) {
				cell.classList.add("drop");
				cell.style.setProperty("--drop-delay", `${drop.delay ?? col * 44 + row * 28}ms`);
				cell.style.setProperty("--drop-speed", `${turbo ? 220 : 760}ms`);
			}

			if (id !== "blank") {
				let img = cell.querySelector("img");
				if (!img) {
					img = document.createElement("img");
				}
				img.className = `symbol ${kind(displayId)}`;
				if (revealSet.has(cellKey) && kind(displayId) === "coin") img.classList.add("spin-reveal");
				img.src = assetMap[displayId] ?? assetMap["10"];
				img.alt = id;
				img.dataset.symbol = id;
				cell.replaceChildren(img);
				const coinLabel = coinValues.get(cellKey) ?? (coinValue == null ? null : formatCoinValue(coinValue));
				if (coinLabel) {
					const label = document.createElement("span");
					label.className = "coin-value-label";
					label.textContent = coinLabel;
					cell.append(label);
				}
			} else {
				cell.replaceChildren();
			}
		}
	}
}

function showFloatingWin(amount, positions) {
	if (!positions.length || amount <= 0) return;
	const center = positions[Math.floor(positions.length / 2)];
	const boardRect = boardEl.getBoundingClientRect();
	const x = boardRect.left + ((center.col + 0.5) / COLS) * boardRect.width;
	const y = boardRect.top + ((center.row + 0.5) / ROWS) * boardRect.height;
	const label = document.createElement("div");
	label.className = amount >= currentBet * 1000 ? "floating-win max" : "floating-win";
	label.textContent = amount >= currentBet * MATH_CONFIG.maxWinMultiplier ? "MAX WIN" : `+${money(amount)}`;
	label.style.left = `${x - 44}px`;
	label.style.top = `${y - 18}px`;
	document.body.append(label);
	setTimeout(() => label.remove(), turbo ? 700 : 1400);
}

async function showWinBanner(amount) {
	if (amount <= 0 || currentBet <= 0) return;
	const multiple = amount / currentBet;
	const isMaxWin = amount >= currentBet * MATH_CONFIG.maxWinMultiplier;
	const tier = isMaxWin
		? { image: "golden_goal_banner" }
		: WIN_BANNER_TIERS.find((entry) => multiple >= entry.threshold);
	if (!tier) return;
	const banner = document.createElement("div");
	banner.className = "win-banner";
	const showBurst = isMaxWin || multiple >= 50;
	banner.innerHTML = `
		<div class="banner-stack">
			${showBurst ? `<img class="burst" src="../assets/ui-kit/coin_burst_overlay.png" alt="" />` : ""}
			<img class="ribbon" src="../assets/ui-kit/${tier.image}.png" alt="" />
			<strong class="banner-amount">${money(amount)}</strong>
		</div>
	`;
	document.body.append(banner);
	await wait(turbo ? 1200 : 2200);
	banner.classList.add("hide");
	await wait(300);
	banner.remove();
}

function allPositions() {
	return Array.from({ length: COLS * ROWS }, (_, i) => ({
		col: i % COLS,
		row: Math.floor(i / COLS),
		delay: (i % COLS) * 30 + Math.floor(i / COLS) * 16,
	}));
}

function countScattersOnBoard(board) {
	return board.flat().filter((symbol) => symbol === "scatter").length;
}

function bonusLevelFromScatterCount(count) {
	if (count >= 5) return 3;
	if (count === 4) return 2;
	if (count === 3) return 1;
	return 0;
}

async function runFeatureEvents(events) {
	for (const event of events) {
		if (event.type === "goldenActivation") {
			const rewardPositions = event.rewards.map((reward) => reward.pos);
			const coinRewards = event.rewards.filter((reward) => reward.type === "coin");
			const coinPositions = coinRewards.map((reward) => reward.pos);
			const baseCoinSymbols = new Map(
				coinRewards.map((reward) => [key(reward.pos), coinVisualIdForValue(reward.baseValue ?? reward.value)]),
			);
			const baseCoinLabels = new Map(
				coinRewards.map((reward) => [key(reward.pos), formatCoinValue(reward.baseValue ?? reward.value)]),
			);
			const finalCoinSymbols = new Map(
				coinRewards.map((reward) => [key(reward.pos), coinVisualIdForValue(reward.value)]),
			);
			const finalCoinLabels = new Map(
				coinRewards.map((reward) => [key(reward.pos), formatCoinValue(reward.value)]),
			);
			const tierSymbols = new Map(
				coinRewards.map((reward) => [key(reward.pos), `${reward.tier}Coin`]),
			);
			if (tierSymbols.size) {
				render({ highlight: event.positions, overrideSymbols: tierSymbols });
				await wait(turbo ? 420 : 980);
			}
			render({ revealCoins: coinPositions, highlight: event.positions, overrideSymbols: baseCoinSymbols, coinValues: baseCoinLabels });
			await wait(turbo ? 620 : 1650);
			if (event.multiplied?.length) {
				render({ pulse: event.multiplierPositions ?? [], multiplied: event.multiplied, overrideSymbols: baseCoinSymbols, coinValues: baseCoinLabels });
				await wait(turbo ? 360 : 820);
				render({ revealCoins: event.multiplied, multiplied: event.multiplied, overrideSymbols: finalCoinSymbols, coinValues: finalCoinLabels });
				await wait(turbo ? 620 : 1500);
			} else if (coinRewards.length) {
				render({ highlight: event.positions, overrideSymbols: finalCoinSymbols, coinValues: finalCoinLabels });
			}
			if (event.collectorPositions?.length) {
				render({ collected: event.coinPositions, pulse: event.collectorPositions, overrideSymbols: finalCoinSymbols, coinValues: finalCoinLabels });
				await wait(turbo ? 420 : 1050);
			}
			currentWin += event.amount;
			winEl.textContent = money(currentWin);
			showFloatingWin(event.amount, rewardPositions.length ? rewardPositions : event.positions);
			await wait(turbo ? 300 : 760);
		}
		if (event.type === "reactivation") {
			render({ pulse: event.positions });
			await wait(turbo ? 320 : 840);
		}
	}
}

async function spin({
	mode = "base",
	bonusLevel = 0,
	cost = currentBet,
	forceRainbow = false,
	forceCluster = false,
	forceScatters = 0,
	bonusHunt = false,
	ante = false,
	suppressBonusStart = false,
} = {}) {
	if (spinning) return;
	spinning = true;
	spinButton.disabled = true;
	spinButton.classList.add("spinning");
	buyBonusButton.disabled = true;
	currentWin = 0;
	winEl.textContent = money(0);
	balance -= cost;
	balanceEl.textContent = money(balance);

	lastBonusTriggered = false;
	math.startSpin({ bet: currentBet, mode, bonusLevel, forceRainbow, forceCluster, forceScatters, bonusHunt, ante, preserveGold: mode !== "base" });
	const startingBonusLevel = mode === "base" ? bonusLevelFromScatterCount(countScattersOnBoard(math.snapshot().board)) : 0;
	render({ dropping: allPositions() });
	await wait(turbo ? 420 : 980);

	for (let cascade = 0; cascade < 30; cascade += 1) {
		const wins = math.findWins();
		if (!wins.length || currentWin >= currentBet * MATH_CONFIG.maxWinMultiplier) break;

		const positions = wins.flatMap((win) => win.positions);
		const cascadeWin = wins.reduce((sum, win) => sum + win.amount, 0);
		currentWin = Math.min(currentBet * MATH_CONFIG.maxWinMultiplier, currentWin + cascadeWin);
		winEl.textContent = money(currentWin);
		render({ highlight: positions });
		showFloatingWin(cascadeWin, positions);
		await wait(turbo ? 360 : 900);

		const drop = math.removeAndDrop(positions, { forceRainbow: bonusLevel === 3 });
		render({ dropping: drop.dropping.map((pos) => ({ ...pos, delay: pos.col * 34 + pos.row * 24 })) });
		await wait(turbo ? 460 : 1100);
	}

	await runFeatureEvents(math.activateFeatures());

	if (mode === "base") {
		math.expireGoldenSquares();
		render();
	}

	await showWinBanner(currentWin);

	balance += currentWin;
	balanceEl.textContent = money(balance);
	spinButton.disabled = freeSpinsPlaying;
	spinButton.classList.remove("spinning");
	buyBonusButton.disabled = freeSpinsPlaying;
	spinning = false;
	if (startingBonusLevel && !suppressBonusStart) {
		lastBonusTriggered = true;
		await showFreeSpinAward(startingBonusLevel);
		await playFreeSpins(startingBonusLevel);
	}
	return { win: currentWin, bonusTriggered: lastBonusTriggered };
}

async function playFreeSpins(level = 1) {
	if (freeSpinsPlaying) return;
	freeSpinsPlaying = true;
	const spins = level === 1 ? 8 : 12;
	let totalBonusWin = 0;
	const guaranteedRainbowSpin = level === 3 ? null : 1 + Math.floor(Math.random() * spins);
	spinButton.disabled = true;
	buyBonusButton.disabled = true;

	for (let spinIndex = 1; spinIndex <= spins; spinIndex += 1) {
		freeSpinsLeft = spins - spinIndex + 1;
		updateSpinCounter();
		const result = await spin({
			mode: `bonus${level}`,
			bonusLevel: level,
			cost: 0,
			forceRainbow: level === 3 || spinIndex === guaranteedRainbowSpin,
		});
		totalBonusWin += result?.win ?? 0;
		freeSpinsLeft = spins - spinIndex;
		updateSpinCounter();
		await wait(turbo ? 420 : 1050);
	}

	freeSpinsPlaying = false;
	freeSpinsLeft = null;
	updateSpinCounter();
	spinButton.disabled = false;
	buyBonusButton.disabled = false;
	await showFreeSpinSummary(spins, totalBonusWin);
}

function waitForModalButton(selector) {
	return new Promise((resolve) => {
		const button = modalText.querySelector(selector);
		if (!button) {
			resolve();
			return;
		}
		button.addEventListener("click", () => {
			closeModal();
			resolve();
		}, { once: true });
	});
}

async function showFreeSpinAward(level) {
	const spins = level === 1 ? 8 : 12;
	const name = level === 1 ? "Striker's Luck" : level === 2 ? "Golden Goal Fever" : "World Cup Rush";
	showRichModal(
		"CONGRATULATIONS",
		`
			<div class="congrats-content">
				<div class="scatter-row">${Array.from({ length: Math.max(3, level + 2) }, () => `<img src="../assets/scatter.png" alt="" />`).join("")}</div>
				<h3>${name}</h3>
				<strong>${spins} FREE SPINS</strong>
				<p>Golden Squares can stay active and wait for a Rainbow reveal.</p>
				<button type="button" class="primary-continue" data-continue>CONTINUE</button>
			</div>
		`,
		"congrats-modal",
	);
	await waitForModalButton("[data-continue]");
}

async function showFreeSpinSummary(spins, totalWin) {
	showRichModal(
		"FREE SPINS COMPLETE",
		`
			<div class="congrats-content">
				<h3>${spins} SPINS PLAYED</h3>
				<strong>${money(totalWin)} WON</strong>
				<p>The final free spins win has been added to your balance.</p>
				<button type="button" class="primary-continue" data-continue>CONTINUE</button>
			</div>
		`,
		"congrats-modal",
	);
	await waitForModalButton("[data-continue]");
}

function showModal(title, text) {
	clearModalContent();
	modal.className = "modal";
	modalCard.className = "modal-card";
	modalTitle.textContent = title;
	modalText.textContent = text;
	modal.hidden = false;
}

function showRichModal(title, html, className = "") {
	clearModalContent();
	modal.className = `modal ${className}`.trim();
	modalCard.className = `modal-card ${className ? `${className}-card` : ""}`.trim();
	modalTitle.textContent = title;
	modalText.innerHTML = html;
	modal.hidden = false;
}

function closeModal() {
	modal.hidden = true;
	clearModalContent();
}

function clearModalContent() {
	document.querySelector(".feature-actions")?.remove();
	modalText.innerHTML = "";
}

function showFeatureBuyMenu() {
	const stake = currentBet;
	const buys = [
		{
			id: "strikerBoost",
			title: "STRIKER BOOST FEATURESPINS",
			text: "Every paid spin is 5x more likely to trigger free spins.",
			volatility: "High",
			price: stake * 3,
			cta: featureSpinMode === "strikerBoost" ? "DISABLE" : "ENABLE",
			visual: `<div class="bonus-feature-symbol"><img src="../assets/scatter.png" alt="" /><b>x5</b></div>`,
			run: () => {
				featureSpinMode = featureSpinMode === "strikerBoost" ? null : "strikerBoost";
				if (featureSpinMode) chanceBoost = false;
				updateBetDisplay();
			},
		},
		{
			id: "rainbowRush",
			title: "RAINBOW RUSH FEATURESPINS",
			text: "Each paid spin is guaranteed to land one Rainbow symbol.",
			volatility: "Medium",
			price: stake * 50,
			cta: featureSpinMode === "rainbowRush" ? "DISABLE" : "ENABLE",
			visual: `<img src="../assets/special/rainbow.png" alt="" />`,
			run: () => {
				featureSpinMode = featureSpinMode === "rainbowRush" ? null : "rainbowRush";
				if (featureSpinMode) chanceBoost = false;
				updateBetDisplay();
			},
		},
		{
			id: "bonus1",
			title: "STRIKER'S LUCK",
			text: "Buy a trigger spin with 3 Scatters, then play 8 Free Spins.",
			volatility: "Medium",
			price: stake * 100,
			cta: "BUY",
			visual: `<div class="scatter-stack">${Array.from({ length: 3 }, () => `<img src="../assets/scatter.png" alt="" />`).join("")}</div>`,
			run: async () => {
				balance -= stake * 100;
				balanceEl.textContent = money(balance);
				await spin({ cost: 0, forceScatters: 3, suppressBonusStart: true });
				await showFreeSpinAward(1);
				await playFreeSpins(1);
			},
		},
		{
			id: "bonus2",
			title: "GOLDEN TROPHY RUSH",
			text: "Buy a trigger spin with 4 Scatters, then play 12 Super Free Spins.",
			volatility: "Medium",
			price: stake * 250,
			cta: "BUY",
			visual: `<div class="scatter-stack">${Array.from({ length: 4 }, () => `<img src="../assets/scatter.png" alt="" />`).join("")}</div>`,
			run: async () => {
				balance -= stake * 250;
				balanceEl.textContent = money(balance);
				await spin({ cost: 0, forceScatters: 4, suppressBonusStart: true });
				await showFreeSpinAward(2);
				await playFreeSpins(2);
			},
		},
	];

	showRichModal(
		"BONUS BUY",
		`
			<div class="bonus-stake-card">
				<span>BET</span>
				<strong>${money(currentBet)}</strong>
				<div>
					<button type="button" data-bet-action="down">-</button>
					<button type="button" data-bet-action="up">+</button>
				</div>
			</div>
			<div class="bonus-cards">
				${buys
					.map(
						(buy) => `
							<article class="bonus-card">
								<h3>${buy.title}</h3>
								<p>${buy.text}</p>
								<div class="bonus-card-visual">${buy.visual}</div>
								<em>Volatility: ${buy.volatility}</em>
								<strong>${money(buy.price)}</strong>
								<button type="button" data-buy-id="${buy.id}" ${balance < buy.price ? "disabled" : ""}>${buy.cta}</button>
							</article>
						`,
					)
					.join("")}
			</div>
		`,
		"bonus-modal",
	);

	modalText.querySelectorAll("[data-buy-id]").forEach((button) => {
		button.addEventListener("click", async () => {
			const buy = buys.find((item) => item.id === button.dataset.buyId);
			if (!buy || spinning || balance < buy.price) return;
			closeModal();
			await buy.run();
		});
	});
	modalText.querySelector("[data-bet-action='up']")?.addEventListener("click", () => {
		changeBet(1);
		showFeatureBuyMenu();
	});
	modalText.querySelector("[data-bet-action='down']")?.addEventListener("click", () => {
		changeBet(-1);
		showFeatureBuyMenu();
	});
}

function showInfoModal() {
	showRichModal(
		"GAME INFO - GOLDEN GOAL RUSH",
		`
			<div class="rules-scroll">
				<section>
					<h3>ABOUT THE GAME</h3>
					<p>Golden Goal Rush is a 6x5 football and gold-coin slot with cluster wins, Super Cascades, Golden Squares, Rainbow reveals, Coins, Multipliers and Collector symbols.</p>
					<p>Maximum win: 10,000x bet. Current simulation target RTP: around 96%.</p>
				</section>
				<section>
					<h3>FEATURES</h3>
					<h4>SUPER CASCADE</h4>
					<p>After every winning cluster, the winning symbols are removed and new symbols drop from above until no new wins are formed.</p>
					<h4>GOLDEN SQUARES</h4>
					<p>Every cell that was part of a winning cluster turns into a Golden Square.</p>
					<div class="rule-visual golden-square"></div>
					<p>If a Rainbow symbol is visible, it activates all Golden Squares. Activated squares reveal Coins, Multipliers, Collectors or Blank results.</p>
					<img class="rule-symbol" src="../assets/special/rainbow.png" alt="" />
					<p>Bronze Coins: 0.2x, 0.5x, 1x, 2x, 4x. Silver Coins: 5x, 10x, 15x, 20x, 25x. Gold Coins: 50x, 100x, 250x, 500x.</p>
					<div class="coin-row">
						<img src="../assets/special/bronze.png" alt="" />
						<img src="../assets/special/silber.png" alt="" />
						<img src="../assets/special/gold.png" alt="" />
					</div>
					<p>Multipliers x2, x3, x4, x5 and x10 apply to adjacent Coins. Multiple adjacent Multipliers are added together. Collector symbols collect the total final Coin value again.</p>
					<div class="coin-row">
						<img src="../assets/special/x2.png" alt="" />
						<img src="../assets/special/x3.png" alt="" />
						<img src="../assets/special/x10.png" alt="" />
						<img src="../assets/special/collector.png" alt="" />
					</div>
				</section>
				<section>
					<h3>FREE SPINS</h3>
					<h4>STRIKER'S LUCK</h4>
					<p>3 Scatters award 8 Free Spins. Golden Squares stay between spins until a Rainbow activates them.</p>
					<h4>GOLDEN TROPHY RUSH</h4>
					<p>4 Scatters award 12 Super Free Spins with higher chances for Silver/Gold Coins, Multipliers and Collectors.</p>
					<h4>WORLD CUP RUSH</h4>
					<p>5 Scatters award 12 premium Free Spins. A Rainbow appears on every spin and Bronze Coins are disabled.</p>
				</section>
				<section>
					<h3>SYMBOL PAYOUTS</h3>
					${paytableHtml()}
				</section>
				<section>
					<h3>HOW TO WIN</h3>
					<p>Connect at least 5 matching regular symbols horizontally or vertically. Diagonal connections do not count. Wild substitutes for regular symbols only.</p>
					<div class="cluster-example">
						<div class="ok">&#10003;</div>
						<div class="mini-grid good"></div>
						<div class="bad">&times;</div>
						<div class="mini-grid bad-grid"></div>
					</div>
				</section>
				<section>
					<h3>FEATURE BUY</h3>
					<p>Striker Boost FeatureSpins cost 3x bet per spin while active. Rainbow Rush FeatureSpins cost 50x bet per spin while active. Striker's Luck costs 100x bet. Golden Trophy Rush costs 250x bet.</p>
				</section>
			</div>
		`,
		"rules-modal",
	);
}

function paytableHtml() {
	const rows = [
		["16+", "3.00", "4.00", "5.00", "7.50", "10.00", "20.00", "25.00", "40.00", "75.00"],
		["13-15", "1.50", "2.00", "2.80", "4.00", "6.00", "10.00", "12.00", "20.00", "35.00"],
		["11-12", "0.80", "1.00", "1.40", "2.00", "3.00", "5.00", "6.00", "10.00", "15.00"],
		["9-10", "0.40", "0.50", "0.70", "1.00", "1.50", "2.50", "3.00", "5.00", "8.00"],
		["7-8", "0.20", "0.25", "0.30", "0.40", "0.60", "1.00", "1.25", "2.00", "3.00"],
		["5-6", "0.10", "0.10", "0.15", "0.20", "0.25", "0.40", "0.50", "0.75", "1.00"],
	];
	const symbols = ["10", "j", "q", "k", "a", "fussball", "pfeife", "pokal", "trikot"];
	return `
		<div class="paytable">
			<div class="pay-symbols"><span></span>${symbols.map((id) => `<img src="${assetMap[id]}" alt="${id}" />`).join("")}</div>
			${rows.map((row) => `<div class="pay-row">${row.map((cell) => `<span>${cell}</span>`).join("")}</div>`).join("")}
		</div>
	`;
}

function changeBet(direction) {
	const index = betSteps.indexOf(currentBet);
	const nextIndex = Math.min(betSteps.length - 1, Math.max(0, index + direction));
	currentBet = betSteps[nextIndex];
	updateBetDisplay();
}

function spinOptionsForCurrentMode() {
	return {
		cost: playCost(),
		ante: chanceBoost,
		bonusHunt: featureSpinMode === "strikerBoost",
		forceRainbow: featureSpinMode === "rainbowRush",
		forceCluster: featureSpinMode === "rainbowRush",
	};
}

function showAutoplayMenu() {
	const roundOptions = [10, 25, 50, 75, 100, 500, 1000];
	const limitOptions = [
		{ label: "5x BET", value: 5 },
		{ label: "20x BET", value: 20 },
		{ label: "50x BET", value: 50 },
		{ label: "NO LIMIT", value: null },
	];
	const winLimitOptions = [
		{ label: "10x BET", value: 10 },
		{ label: "20x BET", value: 20 },
		{ label: "75x BET", value: 75 },
		{ label: "NO LIMIT", value: null },
	];

	showRichModal(
		"AUTOPLAY",
		`
			<div class="autoplay-panel">
				<section>
					<h3>NUMBER OF ROUNDS</h3>
					<div class="pill-grid">
						${roundOptions.map((rounds) => `<button type="button" class="${autoplayOptions.rounds === rounds ? "selected" : ""}" data-rounds="${rounds}">${rounds}</button>`).join("")}
					</div>
				</section>
				<section>
					<h3>STOP AUTOPLAY ON BONUS WIN</h3>
					<button type="button" class="toggle-switch ${autoplayOptions.stopOnBonus ? "on" : ""}" data-toggle-bonus><span></span></button>
				</section>
				<section>
					<h3>LOSS LIMIT</h3>
					<div class="pill-grid">
						${limitOptions.map((item) => `<button type="button" class="${autoplayOptions.lossLimit === item.value ? "selected" : ""}" data-loss="${item.value ?? "none"}">${item.label}</button>`).join("")}
					</div>
				</section>
				<section>
					<h3>SINGLE WIN LIMIT</h3>
					<div class="pill-grid">
						${winLimitOptions.map((item) => `<button type="button" class="${autoplayOptions.singleWinLimit === item.value ? "selected" : ""}" data-win-limit="${item.value ?? "none"}">${item.label}</button>`).join("")}
					</div>
				</section>
				<button type="button" class="primary-continue" data-start-autoplay>START AUTOPLAY</button>
			</div>
		`,
		"autoplay-modal",
	);

	modalText.querySelectorAll("[data-rounds]").forEach((button) => {
		button.addEventListener("click", () => {
			autoplayOptions.rounds = Number(button.dataset.rounds);
			showAutoplayMenu();
		});
	});
	modalText.querySelector("[data-toggle-bonus]")?.addEventListener("click", () => {
		autoplayOptions.stopOnBonus = !autoplayOptions.stopOnBonus;
		showAutoplayMenu();
	});
	modalText.querySelectorAll("[data-loss]").forEach((button) => {
		button.addEventListener("click", () => {
			autoplayOptions.lossLimit = button.dataset.loss === "none" ? null : Number(button.dataset.loss);
			showAutoplayMenu();
		});
	});
	modalText.querySelectorAll("[data-win-limit]").forEach((button) => {
		button.addEventListener("click", () => {
			autoplayOptions.singleWinLimit = button.dataset.winLimit === "none" ? null : Number(button.dataset.winLimit);
			showAutoplayMenu();
		});
	});
	modalText.querySelector("[data-start-autoplay]")?.addEventListener("click", async () => {
		closeModal();
		await runAutoplay();
	});
}

async function runAutoplay() {
	if (spinning) return;
	const startBalance = balance;
	autoSpinButton.classList.add("active");
	try {
		for (let i = 0; i < autoplayOptions.rounds; i += 1) {
			const result = await spin(spinOptionsForCurrentMode());
			if (balance < playCost()) break;
			if (autoplayOptions.stopOnBonus && result?.bonusTriggered) break;
			if (autoplayOptions.lossLimit && startBalance - balance >= currentBet * autoplayOptions.lossLimit) break;
			if (autoplayOptions.singleWinLimit && (result?.win ?? 0) >= currentBet * autoplayOptions.singleWinLimit) break;
		}
	} finally {
		autoSpinButton.classList.remove("active");
	}
}

menuButton.addEventListener("click", () => {
	showInfoModal();
});

buyBonusButton.addEventListener("click", async () => {
	if (spinning) return;
	showFeatureBuyMenu();
});

boostButton.addEventListener("click", () => {
	turbo = !turbo;
	boostButton.classList.toggle("active", turbo);
	boostButton.setAttribute("aria-pressed", String(turbo));
});
autoSpinButton.addEventListener("click", async () => {
	if (spinning) return;
	showAutoplayMenu();
});
betUpButton.addEventListener("click", () => changeBet(1));
betDownButton.addEventListener("click", () => changeBet(-1));
spinButton.addEventListener("click", () => spin(spinOptionsForCurrentMode()));
modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
	if (event.target === modal) closeModal();
});

balanceEl.textContent = money(balance);
winEl.textContent = money(0);
updateBetDisplay();
updateSpinCounter();
render();

window.goldenGoalMath = {
	SYMBOLS,
	COINS,
	MULTIPLIERS,
	MATH_CONFIG,
	runPaidSpin,
	runFreeSpins,
	simulateSpins,
	spin,
	playFreeSpins,
	math,
};
