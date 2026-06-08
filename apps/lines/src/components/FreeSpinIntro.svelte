<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { CanvasSizeRectangle } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { BitmapText, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x00122b} backgroundAlpha={0.68} />

	<FreeSpinAnimation>
		{#snippet children({ sizes })}
			<Text
				anchor={0.5}
				y={-sizes.height * 0.24}
				text="FREE SPINS"
				style={{
					fontFamily: 'gold',
					fontSize: sizes.width * 0.105,
					fontWeight: '900',
					fill: 0xffd447,
					align: 'center',
				}}
			/>
			<BitmapText
				anchor={0.5}
				text={freeSpinsFromEvent}
				style={{
					fontFamily: 'gold',
					fontSize: sizes.width * 0.2,
					fontWeight: 'bold',
				}}
			/>
			<Text
				anchor={0.5}
				y={sizes.height * 0.22}
				text="GOLDEN GOAL RUSH"
				style={{
					fontFamily: 'gold',
					fontSize: sizes.width * 0.065,
					fontWeight: '900',
					fill: 0xffffff,
					align: 'center',
				}}
			/>
		{/snippet}
	</FreeSpinAnimation>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
