import { fromPromise } from 'xstate';

import { API_AMOUNT_MULTIPLIER, BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet, stateUrlDerived, stateModal } from 'state-shared';
import { requestBet, requestEndRound } from 'rgs-requests';

import type { BaseBet } from './types';

type BookEventLike = { type?: string; amount?: number };

const numberOrNull = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const getLastBookAmount = (state: unknown, type: string) => {
	if (!Array.isArray(state)) return null;

	for (let index = state.length - 1; index >= 0; index -= 1) {
		const event = state[index] as BookEventLike;
		if (event?.type !== type) continue;
		return numberOrNull(event.amount);
	}

	return null;
};

const normaliseRoundAmount = (bet: BaseBet | null | undefined) => {
	const amount = numberOrNull(bet?.amount);
	return amount !== null ? amount / API_AMOUNT_MULTIPLIER : 0;
};

const normaliseBetWinContract = <TBet extends BaseBet>(
	bet: TBet,
	options: { source: 'newGame' | 'resumeGame'; wageredBetAmount: number },
) => {
	const finalWinAmount = getLastBookAmount(bet.state, 'finalWin');
	const setTotalWinAmount = getLastBookAmount(bet.state, 'setTotalWin');
	const visibleBookAmount = finalWinAmount ?? setTotalWinAmount;
	const apiBetAmount = numberOrNull(bet.amount);
	const apiPayoutAmount = numberOrNull(bet.payout);
	const rawPayoutMultiplier = numberOrNull(bet.payoutMultiplier);
	const payoutMultiplier =
		rawPayoutMultiplier !== null &&
		rawPayoutMultiplier > 100 &&
		visibleBookAmount !== null &&
		Math.abs(rawPayoutMultiplier - visibleBookAmount) <= 1
			? rawPayoutMultiplier / BOOK_AMOUNT_MULTIPLIER
			: rawPayoutMultiplier;
	const multiplierFromApiAmounts =
		apiBetAmount !== null && apiBetAmount > 0 && apiPayoutAmount !== null
			? apiPayoutAmount / apiBetAmount
			: null;
	const expectedBookAmount =
		payoutMultiplier !== null && payoutMultiplier > 0
			? Math.round(payoutMultiplier * BOOK_AMOUNT_MULTIPLIER)
			: multiplierFromApiAmounts !== null && multiplierFromApiAmounts > 0
				? Math.round(multiplierFromApiAmounts * BOOK_AMOUNT_MULTIPLIER)
				: null;
	const wageredBetAmount = options.wageredBetAmount || normaliseRoundAmount(bet);

	const debugPayload = {
		source: options.source,
		mode: bet.mode,
		wageredBetAmount,
		apiBetAmount,
		apiPayoutAmount,
		rawPayoutMultiplier,
		payoutMultiplier,
		multiplierFromApiAmounts,
		finalWinAmount,
		setTotalWinAmount,
		visibleBookAmount,
		expectedBookAmount,
		displayWin:
			visibleBookAmount !== null ? wageredBetAmount * (visibleBookAmount / BOOK_AMOUNT_MULTIPLIER) : null,
	};

	console.debug('[Golden Goal Rush win contract]', debugPayload);

	if (
		payoutMultiplier !== null &&
		multiplierFromApiAmounts !== null &&
		Math.abs(payoutMultiplier - multiplierFromApiAmounts) > Math.max(0.0001, payoutMultiplier * 0.01)
	) {
		console.warn('[Golden Goal Rush win contract] RGS payout mismatch', debugPayload);
	}

	if (
		expectedBookAmount !== null &&
		visibleBookAmount !== null &&
		Math.abs(expectedBookAmount - visibleBookAmount) > 1
	) {
		console.warn('[Golden Goal Rush win contract] Book win mismatch', debugPayload);
	}

	return bet;
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
