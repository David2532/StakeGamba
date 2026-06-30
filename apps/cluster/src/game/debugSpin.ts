import _ from 'lodash';

import type { Bet, BookEvent, BookEventOfType } from './typesBookEvent';

/**
 * Per-spin win debugging + invariant checks.
 *
 * The point of this is to make every payout traceable: if WIN / BALANCE goes up
 * the console must show *which* symbols won, where, and for how much. It also
 * surfaces "invisible win" bugs early:
 *   - the math reported a totalWin but sent no wins (or wins without positions)
 *   - the per-win amounts do not add up to the reported totalWin
 *
 * Enabled by default. Silence with `localStorage.setItem('clusterWinDebug', 'off')`.
 */

const isEnabled = () => {
	try {
		return globalThis?.localStorage?.getItem('clusterWinDebug') !== 'off';
	} catch {
		return true;
	}
};

type WinInfoEvent = BookEventOfType<'winInfo'>;

const getSpinId = (bet: Bet) =>
	(bet as unknown as { id?: number | string }).id ??
	(bet as unknown as { round?: number | string }).round ??
	bet.event ??
	'n/a';

const winMultiplier = (win: WinInfoEvent['wins'][number]) =>
	win.meta?.globalMult ?? win.meta?.multiplier ?? 1;

export const debugSpin = ({
	bet,
	balanceBefore,
	getBalance,
}: {
	bet: Bet;
	balanceBefore: number;
	getBalance: () => number;
}) => {
	if (!isEnabled()) return;

	const events = bet.state as BookEvent[];
	const winInfos = events.filter((event): event is WinInfoEvent => event.type === 'winInfo');
	const finalWins = events.filter(
		(event): event is BookEventOfType<'finalWin'> => event.type === 'finalWin',
	);

	const allWins = _.flatten(winInfos.map((event) => event.wins));
	const sumWins = _.sumBy(allWins, (win) => win.win ?? 0);
	const totalWin = finalWins.length
		? finalWins[finalWins.length - 1].amount
		: _.sumBy(winInfos, (event) => event.totalWin ?? 0);

	const spinId = getSpinId(bet);
	const balanceDelta = getBalance() - balanceBefore;

	const hasMismatch = winInfos.some(
		(event) => _.sumBy(event.wins, (win) => win.win ?? 0) !== event.totalWin,
	);
	const hasInvisibleWin =
		totalWin > 0 &&
		!allWins.some((win) => Array.isArray(win.positions) && win.positions.length > 0);

	const headerColor = hasMismatch || hasInvisibleWin ? '#ff5555' : '#d4af37';
	// eslint-disable-next-line no-console
	console.groupCollapsed(
		`%c[SPIN ${spinId}] totalWin=${totalWin} balanceΔ=${balanceDelta} wins=${allWins.length}`,
		`color:${headerColor};font-weight:bold`,
	);

	// eslint-disable-next-line no-console
	console.log({
		spinId,
		totalWin,
		balanceBefore,
		balanceDelta,
		sumWins,
		winInfoEvents: winInfos.length,
	});

	allWins.forEach((win, index) => {
		// eslint-disable-next-line no-console
		console.log(`win[${index}]`, {
			symbol: win.symbol,
			amount: win.win,
			multiplier: winMultiplier(win),
			positions: win.positions,
		});
	});

	// assert: every winInfo's wins add up to its reported totalWin
	winInfos.forEach((event, index) => {
		const sum = _.sumBy(event.wins, (win) => win.win ?? 0);
		if (sum !== event.totalWin) {
			// eslint-disable-next-line no-console
			console.error(
				`[ASSERT FAILED] winInfo[${index}] sum(wins.win)=${sum} !== totalWin=${event.totalWin}`,
				event,
			);
		}
	});

	// assert: a positive payout must be backed by at least one visible win with positions
	if (totalWin > 0) {
		if (allWins.length === 0) {
			// eslint-disable-next-line no-console
			console.error(
				`[ASSERT FAILED] totalWin=${totalWin} > 0 but no winInfo events exist → math returned an invisible win`,
				bet,
			);
		} else if (hasInvisibleWin) {
			// eslint-disable-next-line no-console
			console.error(
				`[ASSERT FAILED] totalWin=${totalWin} > 0 but no win has positions → nothing can be highlighted`,
				allWins,
			);
		}
	}

	// eslint-disable-next-line no-console
	console.groupEnd();
};
