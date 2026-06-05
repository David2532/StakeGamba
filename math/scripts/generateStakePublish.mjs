import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { zstdCompressSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const publishDir = resolve(repoRoot, "math", "library", "publish_files", "golden_goal_rush");
const rootMathDir = resolve(repoRoot, "math");
const stakeMathDir = resolve(repoRoot, "upload", "math");
const sampleCount = 4096;
const payoutScale = 100;
const gameId = "golden_goal_rush";
const gameName = "Golden Goal Rush";
const modeConfigs = [
  {
    name: "base",
    cost: 1.0,
    eventsFile: "books_base.jsonl.zst",
    weightsFile: "lookUpTable_base_0.csv",
    spinRequest: { bet: 1 },
  },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function toBoard(grid) {
  return grid.map((row) => row.map((cell) => ({
    id: cell.id,
    label: cell.label ?? null,
    value: cell.value ?? null,
    coinTier: cell.coinTier ?? null,
  })));
}

function toPositions(positions) {
  return positions.map((position) => [position.col, position.row]);
}

function toPayoutMultiplier(multiplier) {
  return Math.max(0, Math.round(multiplier * payoutScale));
}

function buildEvents(result, payoutMultiplier) {
  const events = [
    {
      index: 0,
      type: "reveal",
      mode: result.mode,
      board: toBoard(result.initialGrid),
      scatterCount: result.scatterCount,
      activatorLanded: result.activatorLanded,
      goldenZones: result.goldenZones,
    },
  ];

  for (const cascade of result.cascades) {
    events.push({
      index: events.length,
      type: "cascade",
      cascadeIndex: cascade.index,
      cascadeMultiplier: cascade.cascadeMultiplier,
      removed: toPositions(cascade.removed),
      goldenAdded: toPositions(cascade.goldenAdded),
      board: toBoard(cascade.gridAfter),
      wins: cascade.clusters.map((cluster) => ({
        symbol: cluster.symbol,
        size: cluster.size,
        baseMultiplier: cluster.baseMultiplier,
        cascadeMultiplier: cluster.cascadeMultiplier,
        winMultiplier: cluster.winMultiplier,
        positions: toPositions(cluster.cells),
      })),
    });
  }

  if (result.goldenReveals.length > 0) {
    events.push({
      index: events.length,
      type: "feature",
      reveals: result.goldenReveals.map((reveal) => ({
        position: [reveal.position.col, reveal.position.row],
        id: reveal.id,
        value: reveal.value,
        baseValue: reveal.baseValue,
        coinTier: reveal.coinTier ?? null,
        multiplier: reveal.multiplier ?? null,
        label: reveal.label,
      })),
      captains: result.captainEvents.map((event) => ({
        position: [event.position.col, event.position.row],
        multiplier: event.multiplier,
        targets: toPositions(event.targets),
      })),
      collectors: result.collectorEvents.map((event) => ({
        position: [event.position.col, event.position.row],
        collected: event.collected,
        sources: toPositions(event.sources),
      })),
    });
  }

  events.push({
    index: events.length,
    type: "roundEnd",
    payoutMultiplier,
    totalWinMultiplier: result.totalWinMultiplier,
    totalWin: result.totalWin,
    finalBoard: toBoard(result.finalGrid),
    triggeredBonus: result.triggeredBonus ?? null,
    retriggerSpins: result.retriggerSpins,
    capped: result.capped,
  });

  return events;
}

async function writeModeArtifacts(mathModule, modeConfig) {
  const math = new mathModule.SlotMath(`stake-publish-${modeConfig.name}`, {
    rtp: 96,
    volatility: "medium-high",
  });

  const csvLines = [];
  const jsonlLines = [];

  for (let id = 1; id <= sampleCount; id += 1) {
    const result = math.spin(modeConfig.spinRequest);
    const payoutMultiplier = toPayoutMultiplier(result.totalWinMultiplier);
    csvLines.push(`${id},1,${payoutMultiplier}`);
    jsonlLines.push(JSON.stringify({
      id,
      events: buildEvents(result, payoutMultiplier),
      payoutMultiplier,
    }));
  }

  await writeFile(join(publishDir, modeConfig.weightsFile), csvLines.join("\n") + "\n", "utf8");
  await writeFile(join(publishDir, modeConfig.eventsFile), zstdCompressSync(Buffer.from(jsonlLines.join("\n") + "\n", "utf8")));
}

async function main() {
  await mkdir(publishDir, { recursive: true });
  const mathUrl = `${pathToFileURL(join(publishDir, "math.js")).href}?v=${Date.now()}`;
  const mathModule = await import(mathUrl);

  for (const modeConfig of modeConfigs) {
    await writeModeArtifacts(mathModule, modeConfig);
  }

  const publishIndex = {
    modes: modeConfigs.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      events: mode.eventsFile,
      weights: mode.weightsFile,
    })),
  };

  const rootIndex = {
    modes: modeConfigs.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      events: `library/publish_files/golden_goal_rush/${mode.eventsFile}`,
      weights: `library/publish_files/golden_goal_rush/${mode.weightsFile}`,
    })),
  };

  await writeFile(join(publishDir, "index.json"), JSON.stringify(publishIndex, null, 2) + "\n", "utf8");
  await writeFile(join(publishDir, "game.json"), JSON.stringify(publishIndex, null, 2) + "\n", "utf8");
  await writeFile(join(rootMathDir, "index.json"), JSON.stringify(rootIndex, null, 2) + "\n", "utf8");
  await writeFile(join(rootMathDir, "game.json"), JSON.stringify(rootIndex, null, 2) + "\n", "utf8");

  const publishedFiles = [
    "index.json",
    "game.json",
    ...modeConfigs.flatMap((mode) => [mode.eventsFile, mode.weightsFile]),
  ];
  const fileHashes = {};
  for (const file of publishedFiles) {
    fileHashes[file] = sha256(await readFile(join(publishDir, file)));
  }

  const backendConfig = {
    version: 1,
    changed: false,
    gameId,
    workingName: gameName,
    files: fileHashes,
    modes: modeConfigs.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      events: mode.eventsFile,
      weights: mode.weightsFile,
      rtp: 96,
      maxWin: 10000,
      autoCloseDisabled: false,
      isFeature: false,
      isBuyBonus: false,
    })),
  };

  const frontendConfig = {
    gameId,
    workingName: gameName,
    providerNumber: 0,
    board: {
      reels: 6,
      rows: 5,
    },
    symbols: [
      { id: "10", name: "Ten", type: "low" },
      { id: "J", name: "Jack", type: "low" },
      { id: "Q", name: "Queen", type: "low" },
      { id: "K", name: "King", type: "low" },
      { id: "A", name: "Ace", type: "low" },
      { id: "FOOTBALL", name: "Football", type: "high" },
      { id: "BOOT", name: "Golden Boot", type: "high" },
      { id: "GLOVE", name: "Goalkeeper Glove", type: "high" },
      { id: "TICKET", name: "Stadium Ticket", type: "high" },
      { id: "ARMBAND", name: "Captain Armband", type: "high" },
      { id: "TROPHY", name: "Trophy", type: "high" },
      { id: "LIGHTS", name: "Stadium Lights", type: "special" },
      { id: "WHISTLE", name: "Whistle", type: "special" },
      { id: "GOLDEN_BALL", name: "Golden Ball", type: "special" },
      { id: "CAPTAIN_STAR", name: "Captain Star", type: "special" },
      { id: "COLLECTOR", name: "Trophy Collector", type: "special" },
      { id: "VAR_SCREEN", name: "VAR Screen", type: "special" },
      { id: "WILD_TROPHY", name: "Wild Trophy", type: "special" },
    ],
    betModes: modeConfigs.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      maxWin: 10000,
      rtp: 96,
      isFeature: false,
      isBuyBonus: false,
    })),
    betLevels: [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 50000000, 100000000],
  };

  const mathConfig = {
    gameId,
    workingName: gameName,
    sampleCount,
    payoutScale,
    modes: modeConfigs.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      events: mode.eventsFile,
      weights: mode.weightsFile,
      rtp: 96,
      volatility: "medium-high",
      maxWin: 10000,
    })),
  };

  await rm(stakeMathDir, { recursive: true, force: true });
  await mkdir(stakeMathDir, { recursive: true });
  await copyFile(join(publishDir, "index.json"), join(stakeMathDir, "index.json"));
  await copyFile(join(publishDir, "game.json"), join(stakeMathDir, "game.json"));
  for (const modeConfig of modeConfigs) {
    await copyFile(join(publishDir, modeConfig.eventsFile), join(stakeMathDir, modeConfig.eventsFile));
    await copyFile(join(publishDir, modeConfig.weightsFile), join(stakeMathDir, modeConfig.weightsFile));
  }
  await writeFile(join(stakeMathDir, "config.json"), JSON.stringify(backendConfig, null, 2) + "\n", "utf8");
  await writeFile(join(stakeMathDir, "config_fe.json"), JSON.stringify(frontendConfig, null, 2) + "\n", "utf8");
  await writeFile(join(stakeMathDir, "config_math.json"), JSON.stringify(mathConfig, null, 2) + "\n", "utf8");
}

await main();
