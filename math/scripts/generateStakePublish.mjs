import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zstdCompressSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const publishDir = resolve(repoRoot, "math", "library", "publish_files", "golden_goal_rush");
const rootMathDir = resolve(repoRoot, "math");
const sampleCount = 4096;
const payoutScale = 100;
const modeConfigs = [
  {
    name: "base",
    cost: 1.0,
    eventsFile: "books_base.jsonl.zst",
    weightsFile: "lookUpTable_base_0.csv",
    spinRequest: { bet: 1 },
  },
];

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
}

await main();
