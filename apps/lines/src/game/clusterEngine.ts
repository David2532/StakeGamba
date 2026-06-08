import _ from 'lodash';

import config from './config';
import { BOARD_DIMENSIONS } from './constants';
import type { Position, RawSymbol, SymbolName } from './types';
import type { BookEventOfType } from './typesBookEvent';

const regularSymbols = Object.keys(config.symbols).filter(
	(symbol) => !['S'].includes(symbol),
) as SymbolName[];

const payoutBuckets = [
	{ min: 13, key: '13+' },
	{ min: 11, key: '11-12' },
	{ min: 9, key: '9-10' },
	{ min: 8, key: '8' },
	{ min: 7, key: '7' },
	{ min: 6, key: '6' },
	{ min: 5, key: '5' },
] as const;

const positionKey = (position: Position) => `${position.reel}:${position.row}`;
const getAt = (board: RawSymbol[][], position: Position) => board[position.reel]?.[position.row];
const isWild = (symbol?: RawSymbol) => symbol?.name === 'W';

const getPayout = ({ symbol, count }: { symbol: SymbolName; count: number }) => {
	const paytable = config.symbols[symbol]?.paytable ?? [];
	const bucket = payoutBuckets.find((entry) => count >= entry.min);
	if (!bucket) return 0;

	return paytable.reduce((value, paytableEntry) => {
		const candidate = paytableEntry[bucket.key as keyof typeof paytableEntry];
		return typeof candidate === 'number' ? candidate : value;
	}, 0);
};

const adjacentPositions = ({ reel, row }: Position): Position[] =>
	[
		{ reel: reel - 1, row },
		{ reel: reel + 1, row },
		{ reel, row: row - 1 },
		{ reel, row: row + 1 },
	].filter(
		(position) =>
			position.reel >= 0 &&
			position.reel < BOARD_DIMENSIONS.x &&
			position.row >= 0 &&
			position.row < BOARD_DIMENSIONS.y,
	);

const findCluster = ({
	board,
	start,
	symbol,
	claimed,
}: {
	board: RawSymbol[][];
	start: Position;
	symbol: SymbolName;
	claimed: Set<string>;
}) => {
	const stack = [start];
	const visited = new Set<string>();
	const positions: Position[] = [];

	while (stack.length) {
		const position = stack.pop() as Position;
		const key = positionKey(position);
		if (visited.has(key) || claimed.has(key)) continue;

		const rawSymbol = getAt(board, position);
		if (!rawSymbol || (rawSymbol.name !== symbol && !isWild(rawSymbol))) continue;

		visited.add(key);
		positions.push(position);
		stack.push(...adjacentPositions(position));
	}

	return positions;
};

export const findClusterWins = (board: RawSymbol[][]): BookEventOfType<'winInfo'>['wins'] => {
	const claimed = new Set<string>();
	const wins: BookEventOfType<'winInfo'>['wins'] = [];

	for (const reel of _.range(BOARD_DIMENSIONS.x)) {
		for (const row of _.range(BOARD_DIMENSIONS.y)) {
			const rawSymbol = board[reel]?.[row];
			if (!rawSymbol || rawSymbol.name === 'S' || claimed.has(positionKey({ reel, row }))) continue;

			const symbol = isWild(rawSymbol)
				? regularSymbols.find((candidate) => candidate !== 'W')
				: rawSymbol.name;
			if (!symbol) continue;

			const positions = findCluster({ board, start: { reel, row }, symbol, claimed });
			if (positions.length < 5) continue;

			positions.forEach((position) => claimed.add(positionKey(position)));
			const win = getPayout({ symbol, count: positions.length });
			if (win <= 0) continue;

			wins.push({
				symbol,
				kind: positions.length,
				win,
				positions,
				meta: {
					lineIndex: 0,
					multiplier: 1,
					winWithoutMult: win,
					globalMult: 1,
					lineMultiplier: 1,
					clusterMult: 1,
					overlay: positions[Math.floor(positions.length / 2)],
				},
			});
		}
	}

	return wins;
};

