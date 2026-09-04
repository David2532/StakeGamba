import { isCanonicalMode } from '../contracts/modes.js';
import {
	InsufficientBalanceError,
	RgsContractError,
	encodePresentationCursor,
	normalizeAuthenticateResponse,
	normalizeEndRoundResponse,
	normalizeEventResponse,
	normalizePlayResponse,
	totalPlayAmountApi,
	validateBaseAmount,
} from './contracts.js';

function sessionError(code, message, details = null) {
	return new RgsContractError(code, message, { details });
}

function requireDependency(value, method, label) {
	if (!value || typeof value[method] !== 'function') {
		throw sessionError('SESSION_DEPENDENCY_INVALID', `${label}.${method} is required.`);
	}
}

function errorSnapshot(error) {
	if (!error) return null;
	return Object.freeze({
		name: error.name || 'Error',
		code: error.code || null,
		message: error.message || String(error),
		details: error.details ?? null,
	});
}

function freezeSnapshot(state) {
	return Object.freeze({
		status: state.status,
		balance: state.balance,
		config: state.config,
		selectedBaseAmountApi: state.selectedBaseAmountApi,
		round: state.round,
		presentationPending: state.presentationPending,
		settlementAttempted: state.settlementAttempted,
		lastError: state.lastError,
		presentationError: state.presentationError,
		lastSavedEventCursor: state.lastSavedEventCursor,
	});
}

function nextValidBaseAmount(state) {
	try {
		return validateBaseAmount(state.selectedBaseAmountApi, state.config);
	} catch {
		return state.config.defaultBetLevelApi;
	}
}

export class LiveSessionController {
	/** @param {{client?: any, adapter?: any, sessionID?: string, language?: string, onState?: (state: any) => void}} [options] */
	constructor({ client, adapter, sessionID, language = 'en', onState = () => {} } = {}) {
		requireDependency(client, 'authenticate', 'client');
		requireDependency(client, 'play', 'client');
		requireDependency(client, 'endRound', 'client');
		requireDependency(adapter, 'adaptRoundEvents', 'adapter');
		if (typeof sessionID !== 'string' || sessionID.trim() === '') {
			throw sessionError('SESSION_ID_INVALID', 'sessionID is required.');
		}
		if (typeof onState !== 'function') {
			throw sessionError('SESSION_CALLBACK_INVALID', 'onState must be a function.');
		}

		this.client = client;
		this.adapter = adapter;
		this.sessionID = sessionID.trim();
		this.language = language;
		this.onState = onState;
		this.destroyed = false;
		this.generation = 0;
		this.bootstrapped = false;
		this.bootstrapPromise = null;
		this.playPromise = null;
		this.playIntent = null;
		this.settlementPromise = null;
		this.eventPromise = null;
		this.settlementAttemptedRounds = new WeakSet();
		this.state = {
			status: 'idle',
			balance: null,
			config: null,
			selectedBaseAmountApi: null,
			round: null,
			presentationPending: false,
			settlementAttempted: false,
			lastError: null,
			presentationError: null,
			lastSavedEventCursor: null,
		};
	}

	assertUsable() {
		if (this.destroyed) throw sessionError('SESSION_DESTROYED', 'LiveSessionController is destroyed.');
	}

	update(patch) {
		if (this.destroyed) return this.snapshot();
		this.state = { ...this.state, ...patch };
		const next = this.snapshot();
		this.notify(next);
		return next;
	}

	notify(next) {
		try {
			this.onState(next);
		} catch {
			// Observers are presentation-only and cannot interrupt wallet state transitions.
		}
	}

	snapshot() {
		return freezeSnapshot(this.state);
	}

	bootstrap() {
		this.assertUsable();
		if (this.bootstrapped) return Promise.resolve(this.snapshot());
		if (this.bootstrapPromise) return this.bootstrapPromise;
		const generation = this.generation;
		let task;
		task = (async () => {
			await Promise.resolve();
			if (this.destroyed || generation !== this.generation) return this.snapshot();
			try {
				const raw = await this.client.authenticate({
					sessionID: this.sessionID,
					language: this.language,
				});
				if (this.destroyed || generation !== this.generation) return this.snapshot();
				const authenticated = normalizeAuthenticateResponse(raw, { adapter: this.adapter });
				this.bootstrapped = true;
				if (authenticated.round?.active === true) {
					return this.update({
						status: 'presenting',
						balance: authenticated.balance,
						config: authenticated.config,
						selectedBaseAmountApi: authenticated.round.amountApi,
						round: authenticated.round,
						presentationPending: true,
						settlementAttempted: false,
						lastError: null,
						presentationError: null,
						lastSavedEventCursor: authenticated.round.eventCursor,
					});
				}
				return this.update({
					status: 'ready',
					balance: authenticated.balance,
					config: authenticated.config,
					selectedBaseAmountApi: authenticated.config.defaultBetLevelApi,
					round: null,
					presentationPending: false,
					settlementAttempted: false,
					lastError: null,
					presentationError: null,
					lastSavedEventCursor: null,
				});
			} catch (error) {
				if (!this.destroyed && generation === this.generation) {
					this.update({ status: 'error', lastError: errorSnapshot(error) });
				}
				throw error;
			} finally {
				if (this.bootstrapPromise === task) this.bootstrapPromise = null;
			}
		})();
		this.bootstrapPromise = task;
		this.update({ status: 'authenticating', lastError: null });
		return task;
	}

	selectBaseAmount(amountApi) {
		this.assertUsable();
		if (!this.bootstrapped || !this.state.config) {
			throw sessionError('SESSION_NOT_AUTHENTICATED', 'Authenticate before selecting a base amount.');
		}
		if (this.state.status !== 'ready' || this.state.round || this.playPromise || this.settlementPromise) {
			throw sessionError('SESSION_BUSY', 'Base amount cannot change during an unresolved round.');
		}
		validateBaseAmount(amountApi, this.state.config);
		return this.update({ selectedBaseAmountApi: amountApi, lastError: null });
	}

	play(mode) {
		this.assertUsable();
		if (!isCanonicalMode(mode)) {
			return Promise.reject(sessionError('MODE_INVALID', `Unknown BLACKSITE mode: ${String(mode)}.`));
		}
		if (this.playPromise) {
			if (this.playIntent?.mode === mode) return this.playPromise;
			return Promise.reject(sessionError(
				'SESSION_BUSY',
				`A ${this.playIntent?.mode ?? 'different'} play is already in flight.`,
			));
		}
		const generation = this.generation;
		let requestSent = false;
		let task;
		this.playIntent = Object.freeze({ mode });
		task = (async () => {
			await Promise.resolve();
			try {
				if (!this.bootstrapped) await this.bootstrap();
				this.assertUsable();
				if (this.state.round || this.state.presentationPending || this.settlementPromise) {
					throw sessionError('ACTIVE_ROUND_UNRESOLVED', 'Complete the authoritative round before playing again.');
				}
				if (this.state.status !== 'ready') {
					throw sessionError('SESSION_NOT_READY', 'The paid session is not ready for play.');
				}
				const amountApi = validateBaseAmount(this.state.selectedBaseAmountApi, this.state.config);
				const requiredAmountApi = totalPlayAmountApi(amountApi, mode);
				if (this.state.balance.amountApi < requiredAmountApi) {
					const error = new InsufficientBalanceError({
						requiredAmountApi,
						availableAmountApi: this.state.balance.amountApi,
						source: 'client',
					});
					throw error;
				}
				this.update({ status: 'playing', lastError: null, presentationError: null });
				this.assertUsable();
				requestSent = true;
				const raw = await this.client.play({
					sessionID: this.sessionID,
					currency: this.state.balance.currency,
					amountApi,
					mode,
				});
				if (this.destroyed || generation !== this.generation) return this.snapshot();
				const played = normalizePlayResponse(raw, {
					adapter: this.adapter,
					expectedMode: mode,
					expectedAmountApi: amountApi,
					expectedCurrency: this.state.balance.currency,
				});
				return this.update({
					status: 'presenting',
					balance: played.balance,
					round: played.round,
					presentationPending: true,
					settlementAttempted: false,
					lastError: null,
					lastSavedEventCursor: played.round.eventCursor,
				});
			} catch (error) {
				if (!this.destroyed && generation === this.generation) {
					if (requestSent) {
						this.bootstrapped = false;
						this.update({
							status: error instanceof InsufficientBalanceError
								? 'reauthentication-required'
								: 'error',
							balance: null,
							lastError: errorSnapshot(error),
						});
					} else if (error instanceof InsufficientBalanceError) {
						this.update({ status: 'ready', lastError: errorSnapshot(error) });
					} else if (
						error instanceof RgsContractError
						&& ['ACTIVE_ROUND_UNRESOLVED', 'SESSION_NOT_READY'].includes(error.code)
					) {
						this.update({ lastError: errorSnapshot(error) });
					} else {
						this.update({ status: 'error', lastError: errorSnapshot(error) });
					}
				}
				throw error;
			} finally {
				if (this.playPromise === task) {
					this.playPromise = null;
					this.playIntent = null;
				}
			}
		})();
		this.playPromise = task;
		return task;
	}

	savePresentationCursor(nextEventIndex) {
		this.assertUsable();
		if (typeof this.client.saveEvent !== 'function') {
			return Promise.reject(sessionError(
				'SESSION_EVENT_ENDPOINT_MISSING',
				'client.saveEvent is required to persist presentation progress.',
			));
		}
		const round = this.state.round;
		if (!round || round.active !== true || !this.state.presentationPending) {
			return Promise.reject(sessionError(
				'SESSION_EVENT_NOT_ACTIVE',
				'Presentation progress can only be persisted for an active round.',
			));
		}
		if (
			!Number.isSafeInteger(nextEventIndex)
			|| nextEventIndex < 0
			|| nextEventIndex > round.state.events.length
		) {
			return Promise.reject(sessionError(
				'SESSION_EVENT_CURSOR_INVALID',
				'Presentation cursor must identify the next authoritative event.',
			));
		}
		if (this.state.lastSavedEventCursor !== null && nextEventIndex <= this.state.lastSavedEventCursor) {
			return Promise.resolve(Object.freeze({
				event: encodePresentationCursor(this.state.lastSavedEventCursor),
				nextEventIndex: this.state.lastSavedEventCursor,
			}));
		}
		if (this.eventPromise) {
			return Promise.reject(sessionError(
				'SESSION_EVENT_BUSY',
				'Another presentation cursor write is still in flight.',
			));
		}

		const generation = this.generation;
		const event = encodePresentationCursor(nextEventIndex);
		let task;
		task = (async () => {
			try {
				const raw = await this.client.saveEvent({ sessionID: this.sessionID, event });
				const normalized = normalizeEventResponse(raw, { expectedEvent: event });
				if (!this.destroyed && generation === this.generation) {
					this.update({ lastSavedEventCursor: nextEventIndex, lastError: null });
				}
				return Object.freeze({ ...normalized, nextEventIndex });
			} finally {
				if (this.eventPromise === task) this.eventPromise = null;
			}
		})();
		this.eventPromise = task;
		return task;
	}

	completePresentation() {
		this.assertUsable();
		if (this.settlementPromise) return this.settlementPromise;
		if (this.bootstrapPromise || this.playPromise || this.eventPromise) {
			return Promise.reject(sessionError(
				'SESSION_BUSY',
				'Presentation cannot complete while a wallet request is still in flight.',
			));
		}
		const round = this.state.round;
		if (!round) return Promise.resolve(this.snapshot());
		if (!this.state.presentationPending && this.state.settlementAttempted) {
			return Promise.reject(sessionError(
				'ROUND_SETTLEMENT_ALREADY_ATTEMPTED',
				'Settlement was already attempted for this round.',
			));
		}

		if (round.active !== true) {
			return Promise.resolve(this.update({
				status: 'ready',
				round: null,
				presentationPending: false,
				settlementAttempted: false,
				lastError: null,
				lastSavedEventCursor: null,
			}));
		}
		if (this.settlementAttemptedRounds.has(round)) {
			return Promise.reject(sessionError(
				'ROUND_SETTLEMENT_ALREADY_ATTEMPTED',
				'Settlement was already attempted for this active round.',
			));
		}

		this.settlementAttemptedRounds.add(round);
		const generation = this.generation;
		let task;
		task = (async () => {
			await Promise.resolve();
			try {
				const raw = await this.client.endRound({ sessionID: this.sessionID });
				if (this.destroyed || generation !== this.generation) return this.snapshot();
				const settled = normalizeEndRoundResponse(raw, {
					expectedCurrency: this.state.balance.currency,
				});
				return this.update({
					status: 'ready',
					balance: settled.balance,
					selectedBaseAmountApi: nextValidBaseAmount(this.state),
					round: null,
					presentationPending: false,
					settlementAttempted: true,
					lastError: null,
					lastSavedEventCursor: null,
				});
			} catch (error) {
				if (!this.destroyed && generation === this.generation) {
					this.update({
						status: 'error',
						presentationPending: false,
						settlementAttempted: true,
						lastError: errorSnapshot(error),
					});
				}
				throw error;
			} finally {
				if (this.settlementPromise === task) this.settlementPromise = null;
			}
		})();
		this.settlementPromise = task;
		this.update({
			status: 'settling',
			presentationPending: false,
			settlementAttempted: true,
		});
		return task;
	}

	failPresentation(error) {
		this.assertUsable();
		const failure = error instanceof Error ? error : new Error(String(error || 'Presentation failed'));
		this.update({ presentationError: errorSnapshot(failure) });
		if (!this.state.round) {
			return Promise.resolve(this.update({ status: 'error', lastError: errorSnapshot(failure) }));
		}
		return this.completePresentation();
	}

	destroy() {
		if (this.destroyed) return;
		this.generation += 1;
		this.destroyed = true;
		if (typeof this.client.abortPending === 'function') this.client.abortPending();
		this.eventPromise = null;
		this.state = {
			...this.state,
			status: 'destroyed',
			presentationPending: false,
		};
		const finalState = this.snapshot();
		this.notify(finalState);
		this.onState = () => {};
	}
}
