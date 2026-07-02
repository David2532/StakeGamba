import { fromPromise } from 'xstate';

import { API_AMOUNT_MULTIPLIER, BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet, stateUrlDerived, stateModal } from 'state-shared';
import { requestBet, requestEndRound } from 'rgs-requests';

import type { BaseBet } from './types';

type BookEventLike = {
	index?: number;
	type?: string;
	amount?: number;
	totalWin?: number;
	winLevel?: number;
	[key: string]: unknown;
};

type WinContractDebug = {
	source: 'newGame' | 'resumeGame';
	roundID?: number;
	mode?: string;
	wageredBetAmount: number;
	roundAmountRaw?: number;
	roundPayoutRaw?: number;
	roundPayoutMultiplierRaw?: number;
	resolvedPayoutMultiplier?: number;
	finalWinBookAmount: number | null;
	setTotalWinBookAmount: number | null;
	targetBookAmount: number | null;
	calculatedDisplayWin: number | null;
};

const asFiniteNumber = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const normaliseRoundAmount = (bet: BaseBet | null | undefined) => {
	const amount = asFiniteNumber(bet?.amount);
	return amount !== null ? amount / API_AMOUNT_MULTIPLIER : 0;
};

const winLevelForBookAmount = (amount: number) => {
	if (amount >= 500000) return 7;
	if (amount >= 100000) return 6;
	if (amount >= 50000) return 5;
	if (amount >= 10000) return 4;
	if (amount >= 5000) return 3;
	if (amount >= 1000) return 2;
	return 1;
};

const findLastIndexByType = (state: BookEventLike[], type: string) => {
	for (let index = state.length - 1; index >= 0; index -= 1) {
		if (state[index]?.type === type) return index;
	}
	return -1;
};

const findLastAmountByType = (state: BookEventLike[], type: string) => {
	const index = findLastIndexByType(state, type);
	return index >= 0 ? asFiniteNumber(state[index]?.amount) : null;
};

const resolvePayoutMultiplier = (bet: BaseBet, finalWinBookAmount: number | null) => {
	const rawPayoutMultiplier = asFiniteNumber(bet.payoutMultiplier);
	if (rawPayoutMultiplier === null) return null;

	// Some local/mock books historically used payoutMultiplier as the xBet*100 book
	// amount. When it exactly matches finalWin, normalise it back to a real multiplier.
	if (
		rawPayoutMultiplier > 100 &&
		finalWinBookAmount !== null &&
		Math.abs(rawPayoutMultiplier - finalWinBookAmount) <= 1
	) {
		return rawPayoutMultiplier / BOOK_AMOUNT_MULTIPLIER;
	}

	return rawPayoutMultiplier;
};

const resolvePayoutNormalisedAmount = ({
	payout,
	payoutMultiplier,
	wageredBetAmount,
}: {
	payout: number | null;
	payoutMultiplier: number | null;
	wageredBetAmount: number;
}) => {
	if (payout === null || payout < 0 || wageredBetAmount <= 0) return null;
	if (payout === 0) return 0;
	if (payoutMultiplier === null || payoutMultiplier <= 0) return null;

	const candidates = [
		{ unit: 'api', amount: payout / API_AMOUNT_MULTIPLIER },
		{ unit: 'minor-100', amount: payout / 100 },
		{ unit: 'decimal', amount: payout },
	];

	const ranked = candidates
		.map((candidate) => ({
			...candidate,
			multiplier: candidate.amount / wageredBetAmount,
			error: Math.abs(candidate.amount / wageredBetAmount - payoutMultiplier),
		}))
		.sort((a, b) => a.error - b.error);

	const best = ranked[0];
	const tolerance = Math.max(0.0001, payoutMultiplier * 0.01);
	return best && best.error <= tolerance ? best.amount : null;
};

const resolveTargetBookAmount = ({
	bet,
	wageredBetAmount,
	finalWinBookAmount,
}: {
	bet: BaseBet;
	wageredBetAmount: number;
	finalWinBookAmount: number | null;
}) => {
	const payoutMultiplier = resolvePayoutMultiplier(bet, finalWinBookAmount);
	const payout = asFiniteNumber(bet.payout);
	const payoutNormalisedAmount = resolvePayoutNormalisedAmount({
		payout,
		payoutMultiplier,
		wageredBetAmount,
	});

	if (payoutNormalisedAmount !== null && wageredBetAmount > 0) {
		return Math.max(0, Math.round((payoutNormalisedAmount / wageredBetAmount) * BOOK_AMOUNT_MULTIPLIER));
	}

	if (payoutMultiplier !== null && payoutMultiplier >= 0) {
		return Math.max(0, Math.round(payoutMultiplier * BOOK_AMOUNT_MULTIPLIER));
	}

	return null;
};

const patchLastAmountEvent = ({
	state,
	type,
	targetBookAmount,
	previousBookAmount,
	force,
}: {
	state: BookEventLike[];
	type: string;
	targetBookAmount: number;
	previousBookAmount: number | null;
	force?: boolean;
}) => {
	const index = findLastIndexByType(state, type);
	if (index < 0) return false;

	const currentAmount = asFiniteNumber(state[index]?.amount);
	if (!force && previousBookAmount !== null && currentAmount !== null && Math.abs(currentAmount - previousBookAmount) > 1) {
		return false;
	}

	state[index] = {
		...state[index],
		amount: targetBookAmount,
	};

	if ('winLevel' in state[index]) {
		state[index].winLevel = winLevelForBookAmount(targetBookAmount);
	}

	return true;
};

const normaliseBetWinContract = <TBet extends BaseBet>(
	bet: TBet,
	options: { source: 'newGame' | 'resumeGame'; wageredBetAmount: number },
): TBet => {
	if (!Array.isArray(bet?.state) || bet.state.length === 0) return bet;

	const state = bet.state as BookEventLike[];
	const finalWinBookAmount = findLastAmountByType(state, 'finalWin');
	const setTotalWinBookAmount = findLastAmountByType(state, 'setTotalWin');
	const lastVisibleBookAmount = finalWinBookAmount ?? setTotalWinBookAmount;
	const wageredBetAmount = options.wageredBetAmount || normaliseRoundAmount(bet);
	const targetBookAmount = resolveTargetBookAmount({
		bet,
		wageredBetAmount,
		finalWinBookAmount: lastVisibleBookAmount,
	});
	const resolvedPayoutMultiplier = resolvePayoutMultiplier(bet, lastVisibleBookAmount);
	const debugPayload: WinContractDebug = {
		source: options.source,
		roundID: asFiniteNumber(bet.roundID) ?? undefined,
		mode: typeof bet.mode === 'string' ? bet.mode : undefined,
		wageredBetAmount,
		roundAmountRaw: asFiniteNumber(bet.amount) ?? undefined,
		roundPayoutRaw: asFiniteNumber(bet.payout) ?? undefined,
		roundPayoutMultiplierRaw: asFiniteNumber(bet.payoutMultiplier) ?? undefined,
		resolvedPayoutMultiplier: resolvedPayoutMultiplier ?? undefined,
		finalWinBookAmount,
		setTotalWinBookAmount,
		targetBookAmount,
		calculatedDisplayWin:
			targetBookAmount !== null ? wageredBetAmount * (targetBookAmount / BOOK_AMOUNT_MULTIPLIER) : null,
	};

	console.debug('[StakeGamba win contract]', debugPayload);

	if (targetBookAmount === null || lastVisibleBookAmount === null) return bet;
	if (Math.abs(lastVisibleBookAmount - targetBookAmount) <= 1) return bet;

	console.warn(
		'[StakeGamba win contract] round.state win did not match RGS payout/payoutMultiplier; terminal win events were normalised for display.',
		debugPayload,
	);

	const patchedState = state.map((event) => ({ ...event }));

	patchLastAmountEvent({
		state: patchedState,
		type: 'setTotalWin',
		targetBookAmount,
		previousBookAmount: lastVisibleBookAmount,
		force: true,
	});
	patchLastAmountEvent({
		state: patchedState,
		type: 'finalWin',
		targetBookAmount,
		previousBookAmount: lastVisibleBookAmount,
		force: true,
	});
	patchLastAmountEvent({
		state: patchedState,
		type: 'setWin',
		targetBookAmount,
		previousBookAmount: lastVisibleBookAmount,
	});
	patchLastAmountEvent({
		state: patchedState,
		type: 'freeSpinEnd',
		targetBookAmount,
		previousBookAmount: lastVisibleBookAmount,
	});

	for (let index = patchedState.length - 1; index >= 0; index -= 1) {
		const event = patchedState[index];
		const totalWin = asFiniteNumber(event?.totalWin);
		if (totalWin === null || Math.abs(totalWin - lastVisibleBookAmount) > 1) continue;
		patchedState[index] = {
			...event,
			totalWin: targetBookAmount,
		};
		if ('winLevel' in patchedState[index]) {
			patchedState[index].winLevel = winLevelForBookAmount(targetBookAmount);
		}
		break;
	}

	return {
		...bet,
		state: patchedState,
	} as TBet;
};

const handleRequestBet = async ({ onError }: { onError: () => void }) => {
	try {
		const data = await requestBet({
			rgsUrl: stateUrlDerived.rgsUrl(),
			sessionID: stateUrlDerived.sessionID(),
			currency: stateBet.currency,
			mode: stateBet.activeBetModeKey,
			amount: stateBet.betAmount,
		});

		if (data?.error) {
			throw data;
		}

		if (data?.round?.state && data?.round?.state?.length > 0) {
			stateBet.wageredBetAmount = stateBet.betAmount;

			return data;
		} else {
			throw {
				error: 'Empty state in data.round',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		onError();
		stateBet.autoSpinsCounter = 0;
		stateModal.modal = { name: 'error', error };
		console.error(error);
		throw error;
	}
};

const handleRequestEndRound = async () => {
	if(stateUrlDerived.replay()) return;

	try {
		const data = await requestEndRound({
			sessionID: stateUrlDerived.sessionID(),
			rgsUrl: stateUrlDerived.rgsUrl(),
		});

		if (data?.error) {
			throw data;
		}

		if (data?.balance?.amount !== undefined) {
			return data;
		} else {
			throw {
				error: 'Empty amount in data.balance',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		console.error(error);
	}
};

const handleUpdateBalance = ({ balanceAmountFromApi }: { balanceAmountFromApi: number }) => {
	stateBet.balanceAmount = balanceAmountFromApi / API_AMOUNT_MULTIPLIER;
};

type Options<TBet extends BaseBet> = {
	onResumeGameActive: (betToResume: TBet) => TBet;
	onResumeGameInactive: (betToResume: TBet) => void;
	onNewGameStart: () => Promise<void> | undefined;
	onNewGameError: () => any;
	onPlayGame: (bet: TBet) => Promise<void>;
	checkIsBonusGame: (bet: TBet) => boolean;
};

function createPrimaryMachines<TBet extends BaseBet>(options: Options<TBet>) {
	const {
		onResumeGameActive,
		onResumeGameInactive,
		onNewGameStart,
		onNewGameError,
		onPlayGame,
		checkIsBonusGame,
	} = options;

	let balanceAmountFromApiHolder: null | number = null;

	const BET_TYPE_METHODS_MAP = {
		noWin: {
			newGame: async () => undefined,
			endGame: async () => undefined,
		},
		singleRoundWin: {
			newGame: async () => {
				const endRoundData = await handleRequestEndRound();
				if (endRoundData?.balance) {
					balanceAmountFromApiHolder = endRoundData.balance.amount;
				}
			},
			endGame: async () => {
				if (balanceAmountFromApiHolder !== null) {
					handleUpdateBalance({ balanceAmountFromApi: balanceAmountFromApiHolder });
					balanceAmountFromApiHolder = null;
				}
			},
		},
		bonusWin: {
			newGame: async () => undefined,
			endGame: async () => {
				const data = await handleRequestEndRound();
				if (data?.balance) {
					handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
					balanceAmountFromApiHolder = null;
				}
			},
		},
	} as const;

	const getBetType: (args: { bet: TBet }) => keyof typeof BET_TYPE_METHODS_MAP = ({ bet }) => {
		const isBonusGame = checkIsBonusGame(bet);

		if (bet.active === true) {
			if (isBonusGame) return 'bonusWin';
		}

		if (bet.payoutMultiplier && bet.payoutMultiplier > 0) {
			if (isBonusGame) return 'bonusWin';
			return 'singleRoundWin';
		}

		return 'noWin';
	};

	// newGame
	const newGame = fromPromise(async () => {
		await onNewGameStart();

		const data = await handleRequestBet({ onError: onNewGameError });

		if (data) {
			if (data.balance) {
				handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
			}

			const bet = normaliseBetWinContract(data.round as TBet, {
				source: 'newGame',
				wageredBetAmount: stateBet.wageredBetAmount,
			});
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet };
		}

		return { bet: null };
	});

	// resumeGame
	const resumeGame = fromPromise(async () => {
		const betToResume = stateBet.betToResume as TBet;

		if (betToResume && betToResume.active) {
			// Optional chaining doesn't work here with build-node. 🤷‍♂️
			stateBet.betToResume = null;

			//End Round resumed active bet
			const bet = normaliseBetWinContract(betToResume as TBet, {
				source: 'resumeGame',
				wageredBetAmount: stateBet.wageredBetAmount || normaliseRoundAmount(betToResume),
			});
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet: onResumeGameActive(bet), rawBet: bet };
		}

		if (betToResume && betToResume.state && betToResume.state.length > 0) {
			onResumeGameInactive(betToResume);
		}

		throw new Error('inactive Bet');
	});

	// playGame
	const playGame = fromPromise<void, { bet: TBet | null }>(async ({ input }) => {
		if (input.bet) await onPlayGame(input.bet); // context.bet is hydrated from newGame
	});

	// endGame
	const endGame = fromPromise<void, { bet: TBet | null; rawBet: TBet | null }>(
		async ({ input }) => {
			const targetBet = input.rawBet || input.bet;
			if (targetBet) {
				const betType = getBetType({ bet: targetBet });
				await BET_TYPE_METHODS_MAP[betType].endGame();
			}
		},
	);

	return {
		newGame,
		playGame,
		endGame,
		resumeGame,
	};
}

export { createPrimaryMachines };
