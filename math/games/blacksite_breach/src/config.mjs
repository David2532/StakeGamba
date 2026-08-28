import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const CONFIG_ROOT = join(GAME_ROOT, 'config');
export const LIBRARY_ROOT = join(GAME_ROOT, 'library');
export const PUBLISH_ROOT = join(LIBRARY_ROOT, 'publish_files');
export const LOOKUP_ROOT = join(LIBRARY_ROOT, 'lookup_tables');
export const BOOK_ROOT = join(LIBRARY_ROOT, 'books_compressed');
export const LIBRARY_CONFIG_ROOT = join(LIBRARY_ROOT, 'configs');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const GAME_CONFIG = readJson(join(CONFIG_ROOT, 'game_config.json'));
export const MODE_REGISTRY = readJson(join(CONFIG_ROOT, 'mode_registry.json'));
export const MECHANICS = readJson(join(CONFIG_ROOT, 'mechanics.json'));
export const PAYTABLE = readJson(join(CONFIG_ROOT, 'paytable.json'));
export const EVENT_SCHEMA = readJson(join(CONFIG_ROOT, 'event_schema.json'));
export const VERIFICATION_PROFILE = readJson(join(CONFIG_ROOT, 'math_verification_profile.json'));

export const BOOKS_PER_MODE = GAME_CONFIG.generation.books_per_mode;
export const MAX_WIN_RAW = MODE_REGISTRY.max_win_raw;
export const TARGET_RTP = MODE_REGISTRY.target_rtp;
export const MODE_NAMES = MODE_REGISTRY.modes.map((mode) => mode.name);
export const MODE_BY_NAME = new Map(MODE_REGISTRY.modes.map((mode) => [mode.name, mode]));
export const REGULAR_SYMBOLS = Object.freeze([...MECHANICS.regular_symbols]);
export const SPECIAL_SYMBOLS = Object.freeze([...MECHANICS.special_symbols]);
export const SYMBOLS = Object.freeze([...REGULAR_SYMBOLS, ...SPECIAL_SYMBOLS]);
export const WILD_SYMBOL = MECHANICS.wild.symbol;
export const BREACH_SYMBOL = MECHANICS.trigger.symbol;
export const PAYLINES = Object.freeze(MECHANICS.paylines.map((line) => Object.freeze({
  id: line.id,
  rows: Object.freeze([...line.rows]),
})));
export const PAYOUT_UNIT = GAME_CONFIG.package_payout_unit;

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value)));
}

export const EVENT_SCHEMA_SHA256 = sha256Json(EVENT_SCHEMA);

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function isUint(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function cellKey(cell) {
  return `${cell.column},${cell.row}`;
}

export function parseCellKey(key) {
  const [column, row] = key.split(',').map(Number);
  return { column, row };
}

export function compareCells(left, right) {
  return left.row - right.row || left.column - right.column;
}

export function sortedCells(cells) {
  return [...cells].map((cell) => typeof cell === 'string' ? parseCellKey(cell) : cell).sort(compareCells);
}
