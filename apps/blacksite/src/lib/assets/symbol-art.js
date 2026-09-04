/** @typedef {'byte' | 'relay' | 'proxy' | 'cipher' | 'daemon' | 'vault'} SymbolId */

/**
 * One semantic registry drives the cell label and the deterministic SVG sprite reference.
 * Shape geometry lives in SymbolSprite.svelte so live play, Replay and fixtures render the
 * same authored paths without per-round asset selection or network work.
 *
 * @type {Readonly<Record<SymbolId, Readonly<{ label: string; spriteId: string }>>>}
 */
export const SYMBOL_ART = Object.freeze({
	byte: Object.freeze({ label: 'BYTE', spriteId: 'blacksite-symbol-byte' }),
	relay: Object.freeze({ label: 'RELAY', spriteId: 'blacksite-symbol-relay' }),
	proxy: Object.freeze({ label: 'PROXY', spriteId: 'blacksite-symbol-proxy' }),
	cipher: Object.freeze({ label: 'CIPHER', spriteId: 'blacksite-symbol-cipher' }),
	daemon: Object.freeze({ label: 'DAEMON', spriteId: 'blacksite-symbol-daemon' }),
	vault: Object.freeze({ label: 'VAULT', spriteId: 'blacksite-symbol-vault' }),
});

/**
 * @param {string} symbol
 */
export function symbolSpriteHref(symbol) {
	if (!Object.hasOwn(SYMBOL_ART, symbol)) {
		throw new Error(`Unknown BLACKSITE symbol: ${symbol}`);
	}
	return `#${SYMBOL_ART[/** @type {SymbolId} */ (symbol)].spriteId}`;
}
