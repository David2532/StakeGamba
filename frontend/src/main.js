import { COLS, ROWS, SlotMath, SYMBOL_META, defaultSeed, roundCurrency } from './lib/math.js';

const PhaserRef = window.Phaser;
const BETS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
const START_BALANCE = 5000;
const state = {
  balance: START_BALANCE,
  betIndex: 6,
  lastWin: 0,
  spinCount: 0,
  isSpinning: false,
  turbo: false,
  auto: false,
  freeSpins: 0,
  bonusTotal: 0,
  mode: 'base',
  persistentGoldenZones: [],
  math: new SlotMath(defaultSeed(), { rtp: 96, volatility: 'medium-high' }),
};

const $ = (id) => document.getElementById(id);
const el = {
  app: $('slotApp'), host: $('game-host'), frame: $('reelFrame'), spin: $('spinBtn'), auto: $('autoBtn'), turbo: $('turboBtn'),
  balance: $('balanceValue'), win: $('winValue'), bet: $('betValue'), freeSpins: $('freeSpinsValue'), bonusTotal: $('bonusTotalValue'), unlock: $('unlockProgress'),
  bonusDialog: $('bonusBuyDialog'), infoDialog: $('infoDialog'), buyGrid: $('buyGrid'), toast: $('winToast'), toastTitle: $('toastTitle'), toastAmount: $('toastAmount'),
  bigWin: $('bigWinOverlay'), bigWinTitle: $('bigWinTitle'), bigWinAmount: $('bigWinAmount'), bigWinSub: $('bigWinSub'), confetti: $('confetti'),
};

function money(value) { return `€${roundCurrency(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function currentBet() { return BETS[state.betIndex]; }

class SlotScene extends PhaserRef.Scene {
  constructor() { super('SlotScene'); this.symbols = []; this.currentGrid = null; this.grid = { x: 0, y: 0, w: 100, h: 100, cellW: 100, cellH: 100 }; }
  create() { this.resizeScene(); this.renderGrid(this.randomPreviewGrid(), false); this.scale.on('resize', () => this.resizeScene()); }
  randomPreviewGrid() { const ids = Object.keys(SYMBOL_META).filter((id) => !['GOLDEN_BALL', 'CAPTAIN_STAR', 'COLLECTOR', 'VAR_SCREEN'].includes(id)); return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ id: ids[Math.floor(Math.random() * ids.length)] }))); }
  resizeScene() { const width = this.scale.width; const height = this.scale.height; this.cameras.main.setBackgroundColor('rgba(0,0,0,0)'); const pad = Math.max(8, Math.min(width, height) * 0.018); this.grid.w = width - pad * 2; this.grid.h = height - pad * 2; this.grid.x = pad; this.grid.y = pad; this.grid.cellW = this.grid.w / COLS; this.grid.cellH = this.grid.h / ROWS; this.drawReelBackground(); if (this.currentGrid) this.renderGrid(this.currentGrid, false); }
  drawReelBackground() { if (this.bg) this.bg.destroy(); this.bg = this.add.graphics(); const g = this.bg; g.fillStyle(0x070806, 1); g.fillRect(this.grid.x, this.grid.y, this.grid.w, this.grid.h); for (let row = 0; row < ROWS; row++) { for (let col = 0; col < COLS; col++) { const x = this.grid.x + col * this.grid.cellW; const y = this.grid.y + row * this.grid.cellH; g.fillStyle((row + col) % 2 ? 0x11120f : 0x0b0c0a, 1); g.fillRect(x + 1, y + 1, this.grid.cellW - 2, this.grid.cellH - 2); g.lineStyle(1, 0x5c3c0d, 0.55); g.strokeRect(x, y, this.grid.cellW, this.grid.cellH); } } g.lineStyle(3, 0xf3c44d, 0.5); g.strokeRect(this.grid.x, this.grid.y, this.grid.w, this.grid.h); this.bg.setDepth(-5); }
  clearSymbols() { for (const container of this.symbols) container.destroy(); this.symbols = []; }
  renderGrid(grid, animate = true) { this.currentGrid = grid; this.clearSymbols(); for (let row = 0; row < ROWS; row++) { for (let col = 0; col < COLS; col++) { const container = this.drawSymbol(grid[row][col], col, row); if (animate) { container.y -= this.grid.h * 0.75 + row * 30; container.alpha = 0; this.tweens.add({ targets: container, y: this.cellCenter(col, row).y, alpha: 1, duration: state.turbo ? 160 : 450, delay: col * (state.turbo ? 18 : 55) + row * 18, ease: 'Back.Out' }); } this.symbols.push(container); } } }
  async playResult(result) { this.renderGrid(result.initialGrid, true); await sleep(state.turbo ? 230 : 760); for (const step of result.cascades) { await this.highlightPositions(step.removed, 0xffd34d); await sleep(state.turbo ? 90 : 230); this.renderGrid(step.gridAfter, true); await sleep(state.turbo ? 230 : 520); } if (result.goldenReveals.length) { this.renderGrid(result.finalGrid, false); await this.highlightPositions(result.goldenReveals.map((r) => r.position), 0x28f69b, true); } else { this.renderGrid(result.finalGrid, false); } }
  async highlightPositions(positions, color, pulse = false) { const overlays = []; for (const pos of positions) { const { x, y } = this.cellOrigin(pos.col, pos.row); const rect = this.add.rectangle(x + this.grid.cellW / 2, y + this.grid.cellH / 2, this.grid.cellW - 6, this.grid.cellH - 6, color, 0.18).setStrokeStyle(4, color, 0.9).setDepth(50); overlays.push(rect); this.tweens.add({ targets: rect, scaleX: pulse ? 1.12 : 1.04, scaleY: pulse ? 1.12 : 1.04, alpha: 0.95, duration: 150, yoyo: true, repeat: pulse ? 2 : 0 }); } await sleep(state.turbo ? 140 : 360); overlays.forEach((o) => o.destroy()); }
  cellOrigin(col, row) { return { x: this.grid.x + col * this.grid.cellW, y: this.grid.y + row * this.grid.cellH }; }
  cellCenter(col, row) { return { x: this.grid.x + col * this.grid.cellW + this.grid.cellW / 2, y: this.grid.y + row * this.grid.cellH + this.grid.cellH / 2 }; }
  drawSymbol(cell, col, row) { const c = this.cellCenter(col, row); const size = Math.min(this.grid.cellW, this.grid.cellH); const group = this.add.container(c.x, c.y); group.setSize(this.grid.cellW, this.grid.cellH); this.drawTile(group, size); if (['A', 'K', 'Q', 'J', '10'].includes(cell.id)) this.drawLetter(group, cell.id, size); else if (cell.id === 'FOOTBALL') this.drawFootball(group, size); else if (cell.id === 'BOOT') this.drawBoot(group, size); else if (cell.id === 'GLOVE') this.drawGlove(group, size); else if (cell.id === 'TICKET') this.drawTicket(group, size); else if (cell.id === 'ARMBAND') this.drawArmband(group, size); else if (cell.id === 'TROPHY') this.drawTrophy(group, size, false); else if (cell.id === 'WILD_TROPHY') this.drawTrophy(group, size, true); else if (cell.id === 'WHISTLE') this.drawWhistle(group, size); else if (cell.id === 'LIGHTS') this.drawLights(group, size); else if (cell.id === 'GOLDEN_BALL') this.drawCoin(group, size, cell.label || `${cell.value || 2}x`); else if (cell.id === 'CAPTAIN_STAR') this.drawStar(group, size, cell.label || `${cell.value || 2}x`); else if (cell.id === 'COLLECTOR') this.drawCollector(group, size, cell.label || `${cell.value || 2}x`); else if (cell.id === 'VAR_SCREEN') this.drawVar(group, size); return group; }
  drawTile(group, size) { const g = this.add.graphics(); g.fillStyle(0x0b0d0b, 0.18); g.fillRoundedRect(-size * 0.45, -size * 0.42, size * 0.9, size * 0.84, 8); g.lineStyle(1, 0x73501a, 0.25); g.strokeRoundedRect(-size * 0.45, -size * 0.42, size * 0.9, size * 0.84, 8); group.add(g); }
  addText(group, text, y, fontSize, color, stroke = '#160b02', strokeThickness = 5) { const t = this.add.text(0, y, text, { fontFamily: 'Impact, Arial Black', fontSize: `${fontSize}px`, color, stroke, strokeThickness, align: 'center' }).setOrigin(0.5); t.setShadow(0, 4, '#000', 4, true, true); group.add(t); return t; }
  drawLetter(group, id, size) { const colors = { A: '#e93527', K: '#2da8ff', Q: '#b65cff', J: '#29c957', '10': '#ffd24a' }; this.addText(group, id, 0, size * (id === '10' ? 0.46 : 0.58), colors[id] || '#fff1a0', '#171006', 6); }
  drawFootball(group, size) { const g = this.add.graphics(); g.fillStyle(0xf2f2e8, 1); g.fillCircle(0, 0, size * 0.29); g.lineStyle(3, 0x111111, 1); g.strokeCircle(0, 0, size * 0.29); g.fillStyle(0x111111, 1); g.fillRegularPolygon(0, 0, size * 0.09, 5, Math.PI / 5); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.lineStyle(2, 0x111111, .8); g.lineBetween(Math.cos(a) * size * .1, Math.sin(a) * size * .1, Math.cos(a) * size * .24, Math.sin(a) * size * .24); } group.add(g); }
  drawBoot(group, size) { const g = this.add.graphics(); g.fillStyle(0xf3bd22, 1); g.fillRoundedRect(-size * .28, -size * .03, size * .5, size * .2, 8); g.fillTriangle(-size * .08, -size * .04, size * .05, -size * .35, size * .2, -size * .02); g.fillStyle(0x805106, 1); g.fillRect(-size * .1, size * .13, size * .34, size * .04); g.lineStyle(3, 0xffe48d, .9); g.strokeRoundedRect(-size * .28, -size * .03, size * .5, size * .2, 8); group.add(g); this.addText(group, 'BOOT', size * .28, size * .16, '#fff0b2', '#120902', 3); }
  drawGlove(group, size) { const g = this.add.graphics(); g.fillStyle(0xf6f6ea, 1); g.fillRoundedRect(-size * .26, -size * .18, size * .14, size * .42, 8); g.fillRoundedRect(-size * .1, -size * .27, size * .14, size * .5, 8); g.fillRoundedRect(size * .06, -size * .18, size * .14, size * .42, 8); g.fillRoundedRect(size * .2, -size * .05, size * .11, size * .28, 8); g.fillStyle(0x2d8ee8, 1); g.fillRoundedRect(-size * .25, size * .1, size * .5, size * .17, 6); g.lineStyle(3, 0x111111, .8); g.strokeRoundedRect(-size * .3, -size * .28, size * .62, size * .58, 10); group.add(g); }
  drawTicket(group, size) { const g = this.add.graphics(); g.fillStyle(0xf2c341, 1); g.fillRoundedRect(-size * .34, -size * .2, size * .68, size * .4, 8); g.lineStyle(3, 0x2b1603, .9); g.strokeRoundedRect(-size * .34, -size * .2, size * .68, size * .4, 8); group.add(g); this.addText(group, 'STADIUM', -size * .06, size * .14, '#3b2106', '#f2c341', 1); this.addText(group, 'PASS', size * .11, size * .18, '#3b2106', '#f2c341', 1); }
  drawArmband(group, size) { const g = this.add.graphics(); g.fillStyle(0x1d8dd8, 1); g.fillRoundedRect(-size * .34, -size * .18, size * .68, size * .36, 16); g.fillStyle(0xffffff, 1); g.fillRect(-size * .09, -size * .18, size * .18, size * .36); g.lineStyle(3, 0x071822, .9); g.strokeRoundedRect(-size * .34, -size * .18, size * .68, size * .36, 16); group.add(g); this.addText(group, 'C', 0, size * .26, '#151515', '#ffffff', 2); }
  drawTrophy(group, size, wild) { const g = this.add.graphics(); /* omitted for brevity in build copy */ }
}

// Boot Phaser game into #game-host
const config = { type: PhaserRef.AUTO, parent: 'game-host', width: 800, height: 600, scene: [SlotScene], scale: { mode: PhaserRef.Scale.FIT, autoCenter: PhaserRef.Scale.CENTER_BOTH } };
new PhaserRef.Game(config);
