import { randomInt } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOOKUP_ROOT,
  MODE_BY_NAME,
} from '../../../math/games/blacksite_breach/src/config.mjs';
import { buildBook } from '../../../math/games/blacksite_breach/src/model.mjs';
import { variantizeDevBookWithReport } from './dev-book-visual-variantizer.mjs';

const ENDPOINT = '/__blacksite/dev/math-round';
const ALLOWED_MODES = Object.freeze(['base', 'deep_access', 'blackout']);
const ALLOWED_MODE_SET = new Set(ALLOWED_MODES);
const MAX_QUERY_LENGTH = 512;
const MAX_LOOKUP_BYTES = 32 * 1024 * 1024;
const MAX_LOOKUP_ROWS = 1_000_000;
const MAX_RANDOM_INTEGER = 2 ** 48 - 1;
const VISUAL_SEED_RANGE = 2 ** 32;
const lookupCache = new Map();

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(body);
}

function sendError(response, statusCode, code, message, extraHeaders) {
  sendJson(response, statusCode, { error: { code, message } }, extraHeaders);
}

function parseUnsignedInteger(raw, label) {
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be an unsigned integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${label} exceeds the safe integer range`);
  return value;
}

function loadLookup(mode) {
  const cached = lookupCache.get(mode);
  if (cached) return cached;

  const lookupPath = join(LOOKUP_ROOT, `${mode}_lookup.csv`);
  const lookupSize = statSync(lookupPath).size;
  if (lookupSize <= 0 || lookupSize > MAX_LOOKUP_BYTES) {
    throw new Error(`${mode} lookup size is outside the DEV endpoint limit`);
  }

  const text = readFileSync(lookupPath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0 || lines.length > MAX_LOOKUP_ROWS) {
    throw new Error(`${mode} lookup row count is outside the DEV endpoint limit`);
  }

  const seenIds = new Set();
  const selectable = [];
  let totalWeight = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const columns = lines[index].split(',');
    if (columns.length !== 3) throw new Error(`${mode} lookup row ${index + 1} must have three columns`);

    const id = parseUnsignedInteger(columns[0], `${mode} lookup id at row ${index + 1}`);
    const weight = parseUnsignedInteger(columns[1], `${mode} lookup weight at row ${index + 1}`);
    const payout = parseUnsignedInteger(columns[2], `${mode} lookup payout at row ${index + 1}`);
    if (id < 1) throw new Error(`${mode} lookup id at row ${index + 1} must be positive`);
    if (seenIds.has(id)) throw new Error(`${mode} lookup contains duplicate id ${id}`);
    seenIds.add(id);

    if (weight === 0) continue;
    totalWeight += weight;
    if (!Number.isSafeInteger(totalWeight) || totalWeight > MAX_RANDOM_INTEGER) {
      throw new Error(`${mode} lookup total weight exceeds the DEV endpoint limit`);
    }
    selectable.push({ id, weight, payout, cumulativeWeight: totalWeight });
  }

  if (selectable.length === 0 || totalWeight === 0) {
    throw new Error(`${mode} lookup has no positive-weight outcomes`);
  }

  const lookup = Object.freeze({ selectable, totalWeight });
  lookupCache.set(mode, lookup);
  return lookup;
}

function selectWeightedRow(mode) {
  const { selectable, totalWeight } = loadLookup(mode);
  const ticket = randomInt(totalWeight);
  let low = 0;
  let high = selectable.length - 1;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (ticket < selectable[middle].cumulativeWeight) high = middle;
    else low = middle + 1;
  }

  return selectable[low];
}

function parseMode(requestUrl) {
  if (requestUrl.length > MAX_QUERY_LENGTH) return null;
  const url = new URL(requestUrl, 'http://blacksite.local');
  const keys = [...new Set(url.searchParams.keys())];
  const modeValues = url.searchParams.getAll('mode');
  if (keys.length !== 1 || keys[0] !== 'mode' || modeValues.length !== 1) return null;
  return ALLOWED_MODE_SET.has(modeValues[0]) ? modeValues[0] : null;
}

export function blacksiteDevMathRoundPlugin() {
  return {
    name: 'blacksite-dev-math-round',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url ?? '';
        if (requestUrl.split('?', 1)[0] !== ENDPOINT) return next();

        if (request.method !== 'GET') {
          sendError(
            response,
            405,
            'METHOD_NOT_ALLOWED',
            'Use GET for the DEV math-round endpoint.',
            { Allow: 'GET' },
          );
          return;
        }

        const mode = parseMode(requestUrl);
        if (!mode) {
          sendError(
            response,
            400,
            'INVALID_QUERY',
            `Provide exactly one mode: ${ALLOWED_MODES.join(', ')}.`,
          );
          return;
        }

        try {
          const modeConfig = MODE_BY_NAME.get(mode);
          if (!modeConfig) throw new Error(`missing canonical mode ${mode}`);
          const selected = selectWeightedRow(mode);
          const canonicalBook = buildBook(modeConfig, selected.id, selected.payout);
          const visualSeed = randomInt(VISUAL_SEED_RANGE);
          const { book, report: visualVariant } = variantizeDevBookWithReport(canonicalBook, visualSeed);
          sendJson(response, 200, {
            fixtureId: `${mode}_random`,
            mode,
            mathBacked: true,
            bookId: selected.id,
            lookupWeight: selected.weight,
            visualVariant,
            book,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          server.config.logger.error(`[blacksite-dev-math-round] ${message}`);
          sendError(
            response,
            500,
            'MATH_ROUND_UNAVAILABLE',
            'The published DEV math round could not be loaded.',
          );
        }
      });
    },
  };
}
