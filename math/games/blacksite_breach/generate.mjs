import { once } from 'node:events';
import {
  copyFileSync,
  createWriteStream,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createZstdCompress } from 'node:zlib';
import {
  BOOK_ROOT,
  BOOKS_PER_MODE,
  CONFIG_ROOT,
  GAME_CONFIG,
  LIBRARY_CONFIG_ROOT,
  LOOKUP_ROOT,
  MODE_REGISTRY,
  PUBLISH_ROOT,
} from './src/config.mjs';
import { allocateModePayouts, buildBook } from './src/model.mjs';

function ensureDirectories() {
  for (const directory of [BOOK_ROOT, LOOKUP_ROOT, PUBLISH_ROOT, LIBRARY_CONFIG_ROOT]) {
    mkdirSync(directory, { recursive: true });
  }
}

async function writeChunk(stream, chunk) {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

async function closeStream(stream) {
  stream.end();
  await once(stream, 'close');
}

async function generateMode(mode) {
  const payouts = allocateModePayouts(mode);
  const lookupPath = join(LOOKUP_ROOT, `${mode.name}_lookup.csv`);
  const booksPath = join(BOOK_ROOT, `${mode.name}_books.jsonl.zst`);
  const lookup = createWriteStream(lookupPath, { encoding: 'utf8', flags: 'w' });
  const compressedOutput = createWriteStream(booksPath, { flags: 'w' });
  const compressor = createZstdCompress({ params: { 100: 9 } });
  compressor.pipe(compressedOutput);

  let eventCount = 0;
  for (let id = 1; id <= BOOKS_PER_MODE; id += 1) {
    const payoutRaw = payouts[id];
    const book = buildBook(mode, id, payoutRaw);
    eventCount += book.events.length;
    await writeChunk(lookup, `${id},1,${payoutRaw}\n`);
    await writeChunk(compressor, `${JSON.stringify(book)}\n`);
    if (id % 10000 === 0) {
      process.stdout.write(`[generate] ${mode.name}: ${id}/${BOOKS_PER_MODE} books\n`);
    }
  }

  await closeStream(lookup);
  compressor.end();
  await once(compressedOutput, 'close');
  process.stdout.write(`[generate] ${mode.name}: ${eventCount} events\n`);
  return { mode: mode.name, payouts, eventCount };
}

function writeIndexAndConfigs() {
  const index = {
    modes: MODE_REGISTRY.modes.map((mode) => ({
      name: mode.name,
      cost: mode.cost,
      events: `${mode.name}_books.jsonl.zst`,
      weights: `${mode.name}_lookup.csv`,
    })),
  };
  writeFileSync(join(PUBLISH_ROOT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  for (const name of [
    'game_config.json',
    'mode_registry.json',
    'mechanics.json',
    'paytable.json',
    'event_schema.json',
    'math_verification_profile.json',
  ]) {
    copyFileSync(join(CONFIG_ROOT, name), join(LIBRARY_CONFIG_ROOT, name));
  }
}

export async function generateCandidate({ verify = true } = {}) {
  ensureDirectories();
  process.stdout.write(`[generate] ${GAME_CONFIG.game_id} ${GAME_CONFIG.candidate_version} (${GAME_CONFIG.lifecycle})\n`);
  writeIndexAndConfigs();
  const results = [];
  for (const mode of MODE_REGISTRY.modes) {
    results.push(await generateMode(mode));
  }
  if (verify) {
    const { verifyCandidate } = await import('./verify.mjs');
    await verifyCandidate({ writeAudits: true });
  }
  return results;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  generateCandidate({ verify: !process.argv.includes('--no-verify') }).catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
