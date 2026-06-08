import { findClusterWins } from '../../game/clusterEngine';
import type { Bet } from '../../game/typesBookEvent';
import type { RawSymbol } from '../../game/types';

const board: RawSymbol[][] = [
	[{ name: 'H3' }, { name: 'H3' }, { name: 'L1' }, { name: 'L4' }, { name: 'H1' }],
	[{ name: 'H3' }, { name: 'H3' }, { name: 'H3' }, { name: 'L5' }, { name: 'L2' }],
	[{ name: 'L2' }, { name: 'H3' }, { name: 'H3' }, { name: 'H1' }, { name: 'L3' }],
	[{ name: 'L4' }, { name: 'H2' }, { name: 'H3' }, { name: 'H3' }, { name: 'L5' }],
	[{ name: 'L1' }, { name: 'H2' }, { name: 'W', wild: true }, { name: 'H3' }, { name: 'L4' }],
	[{ name: 'H1' }, { name: 'L3' }, { name: 'H2' }, { name: 'L2' }, { name: 'L5' }],
];

const wins = findClusterWins(board);
const explodingSymbols = wins.flatMap((win) => win.positions);
const newSymbols: RawSymbol[][] = board.map((_, reelIndex) => {
	const addCount = explodingSymbols.filter((position) => position.reel === reelIndex).length;
	const replacements: RawSymbol[] = [
		{ name: 'L1' },
		{ name: 'H1' },
		{ name: 'L4' },
		{ name: 'H2' },
		{ name: 'L5' },
		{ name: 'L2' },
	];

	return replacements.slice(0, addCount);
});
const totalWin = wins.reduce((total, win) => total + win.win, 0);
const amount = Math.round(totalWin * 100);

export default {
	id: 9001,
	payoutMultiplier: totalWin,
	events: [
		{
			index: 0,
			type: 'reveal',
			board,
			paddingPositions: [0, 0, 0, 0, 0, 0],
			gameType: 'basegame',
			anticipation: [0, 0, 0, 0, 0, 0],
		},
		{
			index: 1,
			type: 'winInfo',
			totalWin: amount,
			wins: wins.map((win) => ({
				...win,
				win: Math.round(win.win * 100),
				meta: {
					...win.meta,
					winWithoutMult: Math.round(win.meta.winWithoutMult * 100),
				},
			})),
		},
		{
			index: 2,
			type: 'tumbleBoard',
			explodingSymbols,
			newSymbols,
		},
		{ index: 3, type: 'setWin', amount, winLevel: totalWin >= 5 ? 3 : 2 },
		{ index: 4, type: 'setTotalWin', amount },
		{ index: 5, type: 'finalWin', amount },
	],
	criteria: 'cluster-demo',
	baseGameWins: totalWin,
	freeGameWins: 0,
} satisfies Bet & {
	id: number;
	payoutMultiplier: number;
	criteria: string;
	baseGameWins: number;
	freeGameWins: number;
};
