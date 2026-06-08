<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { BitmapText, Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';

	const context = getContext();
	const panelSizes = {
		width: SYMBOL_SIZE * 2.05,
		height: SYMBOL_SIZE * 1.35,
	};
	const position = $derived({
		x:
			context.stateGameDerived.boardLayout().x -
			context.stateGameDerived.boardLayout().width * 0.5 -
			panelSizes.width -
			SYMBOL_SIZE * 0.7,
		y:
			context.stateGameDerived.boardLayout().y -
			context.stateGameDerived.boardLayout().height * 0.5 +
			panelSizes.height * 0.5,
	});

	let show = $state(false);
	let current = $state(0);
	let total = $state(0);

	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (show = true),
		freeSpinCounterHide: () => (show = false),
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) current = emitterEvent.current;
			if (emitterEvent.total !== undefined) total = emitterEvent.total;
		},
	});
</script>

<MainContainer>
	<FadeContainer {show} {...position}>
		<Container>
			<Rectangle
				anchor={0.5}
				width={panelSizes.width}
				height={panelSizes.height}
				backgroundColor={0x03162f}
				backgroundAlpha={0.92}
				borderColor={0xffd447}
				borderWidth={6}
				borderRadius={24}
			/>
			<Text
				anchor={0.5}
				y={-panelSizes.height * 0.22}
				text="FREE KICKS"
				style={{
					fontFamily: 'proxima-nova',
					fontSize: SYMBOL_SIZE * 0.21,
					fontWeight: '900',
					fill: 0xffd447,
					align: 'center',
				}}
			/>
			<BitmapText
				anchor={0.5}
				y={panelSizes.height * 0.17}
				text={`${current} / ${total}`}
				style={{
					fontFamily: 'gold',
					fontSize: SYMBOL_SIZE * 0.34,
				}}
			/>
		</Container>
	</FadeContainer>
</MainContainer>
