import { OPERATOR_SEQUENCE } from './operator-animation-director.js';

const RAGE_INTERVAL = 6;
const DEFAULT_DEDUPE_LIMIT = 256;

function validDedupeToken(token) {
	return (
		(typeof token === 'string' && token.length > 0) ||
		(typeof token === 'number' && Number.isSafeInteger(token) && token >= 0)
	);
}

function classifyZeroStreak(zeroStreak, rageEnabled) {
	if (rageEnabled && zeroStreak % RAGE_INTERVAL === 0) return OPERATOR_SEQUENCE.RAGE;
	if (zeroStreak >= 3) return OPERATOR_SEQUENCE.LOSS_STREAK;
	return OPERATOR_SEQUENCE.LOSS;
}

function createSnapshot(zeroStreak, committedRounds) {
	return Object.freeze({ zeroStreak, committedRounds });
}

/**
 * Session-local accounting for finalized live outcomes only. The caller owns
 * authority and must call commit exactly after a live round has been finalized;
 * replay, restore, aborted rounds, and UI previews must never call this class.
 * Recent finalized IDs are retained in a bounded rolling dedupe window.
 */
export class LiveOutcomeStreakTracker {
	constructor({ dedupeLimit = DEFAULT_DEDUPE_LIMIT, rageEnabled = false } = {}) {
		if (!Number.isSafeInteger(dedupeLimit) || dedupeLimit <= 0) {
			throw new TypeError('dedupeLimit must be a positive safe integer.');
		}
		this.dedupeLimit = dedupeLimit;
		this.rageEnabled = rageEnabled === true;
		this.zeroStreak = 0;
		this.committedRounds = 0;
		this.committedTokens = new Set();
		this.committedTokenQueue = [];
		this.state = createSnapshot(0, 0);
	}

	get snapshot() {
		return this.state;
	}

	get dedupeSize() {
		return this.committedTokens.size;
	}

	commit({ dedupeToken, payoutRaw } = {}) {
		if (!validDedupeToken(dedupeToken)) {
			throw new TypeError('dedupeToken must be a non-empty string or non-negative safe integer.');
		}
		if (!Number.isSafeInteger(payoutRaw) || payoutRaw < 0) {
			throw new TypeError('payoutRaw must be a non-negative safe integer.');
		}

		if (this.committedTokens.has(dedupeToken)) {
			return Object.freeze({
				accepted: false,
				duplicate: true,
				reaction: null,
				...this.state,
			});
		}

		this.committedTokens.add(dedupeToken);
		this.committedTokenQueue.push(dedupeToken);
		while (this.committedTokenQueue.length > this.dedupeLimit) {
			this.committedTokens.delete(this.committedTokenQueue.shift());
		}
		this.committedRounds += 1;
		this.zeroStreak = payoutRaw === 0 ? this.zeroStreak + 1 : 0;
		this.state = createSnapshot(this.zeroStreak, this.committedRounds);
		return Object.freeze({
			accepted: true,
			duplicate: false,
			reaction: payoutRaw === 0 ? classifyZeroStreak(this.zeroStreak, this.rageEnabled) : null,
			...this.state,
		});
	}
}
