import { stateBet } from 'state-shared';

import type { Reel, GetRawSymbolFromReel } from './types';
import { stateSlots } from './stateSlots.svelte';

// Every concrete reel specialization is preserved through TReel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEnhanceBoardPreSpin<TReel extends Reel<any, any>>({
	board,
}: {
	board: TReel[];
}) {
	type TRawSymbol = GetRawSymbolFromReel<TReel>;

	const preSpin = async ({ paddingBoard }: { paddingBoard?: TRawSymbol[][] }) => {
		stateSlots.isPreSpinning = true;

		const isTurboBeforeAll = stateBet.isTurbo;

		await Promise.all(
			board.map((reel, reelIndex) => {
				// @ts-expect-error paddingReel is not required by the cascading reel specialization.
				return reel.preSpin({ isTurboBeforeAll, preSpinPaddingReel: paddingBoard?.[reelIndex] });
			}),
		);
	};

	return { preSpin };
}
