import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../art/asset-manifest.json', import.meta.url);
const pageUrl = new URL('../src/routes/+page.svelte', import.meta.url);
const registryUrl = new URL('../src/lib/assets/symbol-art.js', import.meta.url);
const markUrl = new URL('../src/lib/components/SymbolMark.svelte', import.meta.url);
const spriteUrl = new URL('../src/lib/components/SymbolSprite.svelte', import.meta.url);

const SYMBOLS = Object.freeze(['byte', 'relay', 'proxy', 'cipher', 'daemon', 'vault']);

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

test('symbol art registry is complete, immutable and deterministic', async () => {
	const { SYMBOL_ART, symbolSpriteHref } = await import(registryUrl.href);

	assert.deepEqual(Object.keys(SYMBOL_ART), SYMBOLS);
	assert.equal(Object.isFrozen(SYMBOL_ART), true);
	for (const symbol of SYMBOLS) {
		assert.equal(Object.isFrozen(SYMBOL_ART[symbol]), true);
		assert.equal(SYMBOL_ART[symbol].label, symbol.toUpperCase());
		assert.equal(SYMBOL_ART[symbol].spriteId, `blacksite-symbol-${symbol}`);
		assert.equal(symbolSpriteHref(symbol), `#blacksite-symbol-${symbol}`);
	}
	assert.throws(() => symbolSpriteHref('unknown'), /Unknown BLACKSITE symbol/u);
});

test('one local vector sprite defines six silhouette-distinct, text-free symbols', async () => {
	const source = await readFile(spriteUrl, 'utf8');

	assert.equal((source.match(/<symbol\b/gu) ?? []).length, SYMBOLS.length);
	for (const symbol of SYMBOLS) {
		assert.match(source, new RegExp(`id="blacksite-symbol-${symbol}"`, 'u'));
	}
	assert.equal((source.match(/viewBox="0 0 64 64"/gu) ?? []).length, SYMBOLS.length + 1);
	assert.match(source, /vector-effect="non-scaling-stroke"/u);
	assert.match(source, /stroke="currentColor"/u);
	assert.doesNotMatch(source, /<(?:text|image|foreignObject)\b/iu);
	assert.doesNotMatch(source, /(?:https?:|data:|Math\.random|Date\.now)/u);
	assert.ok(Buffer.byteLength(source) <= 12_000, 'inline sprite exceeds the 12 KB source budget');
});

test('board renders lightweight vector references while preserving one accessible cell name', async () => {
	const [page, mark] = await Promise.all([readFile(pageUrl, 'utf8'), readFile(markUrl, 'utf8')]);

	assert.match(page, /import SymbolMark from ['"]\.\.\/lib\/components\/SymbolMark\.svelte['"]/u);
	assert.match(
		page,
		/import SymbolSprite from ['"]\.\.\/lib\/components\/SymbolSprite\.svelte['"]/u,
	);
	assert.equal((page.match(/<SymbolSprite\s*\/>/gu) ?? []).length, 1);
	assert.match(page, /<SymbolMark \{symbol\} \/>/u);
	assert.match(page, /aria-label=\{`Column \$\{cell\.column \+ 1\}, row/u);
	assert.doesNotMatch(page, /mark:\s*['"](?:01|↯|◆|⌁|△|⬡)['"]/u);

	assert.match(mark, /aria-hidden="true"/u);
	assert.match(mark, /focusable="false"/u);
	assert.match(mark, /data-symbol-art=\{symbol\}/u);
	assert.match(mark, /<use href=\{spriteHref\}/u);
	assert.doesNotMatch(mark, /(?:Math\.random|Date\.now|fetch\()/u);
	assert.ok(Buffer.byteLength(mark) <= 3_000, 'per-cell renderer exceeds the 3 KB source budget');
});

test('compiled-inline production candidate is provenance-bound without a runtime request', async () => {
	const [manifest, sprite] = await Promise.all([
		readFile(manifestUrl, 'utf8').then(JSON.parse),
		readFile(spriteUrl),
	]);
	const asset = manifest.assets.find(
		(candidate) => candidate.id === 'product.symbols.core_inline_sprite.v1',
	);
	const group = manifest.requiredProductionGroups.find(
		(candidate) => candidate.id === 'symbols-six-production-sprites',
	);

	assert.ok(asset);
	assert.equal(asset.status, 'production-candidate');
	assert.equal(asset.path, 'apps/blacksite/src/lib/components/SymbolSprite.svelte');
	assert.equal(asset.sourceSha256, sha256(sprite));
	assert.equal(asset.runtimePath, null);
	assert.equal(asset.runtimeEligible, true);
	assert.equal(asset.runtimeEmbedding, 'compiled-inline-svg-sprite');
	assert.deepEqual(asset.statesAnimations, ['idle-readable', 'win-readable', 'dim-readable']);
	assert.match(asset.reviewLimitations, /human Creative\/Compliance/u);
	assert.equal(group.status, 'production-candidate-integrated-human-review-pending');
});
