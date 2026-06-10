<script lang="ts">
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	type Props = {
		onloaded: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	// Go straight into the slot: as soon as the assets are loaded, skip the
	// press-to-continue / "KICK OFF" transition and show the game board directly.
	$effect(() => {
		if (context.stateApp.loaded) {
			props.onloaded();
		}
	});
</script>

<!-- logo + loading progress (only while assets are still loading) -->
<FadeContainer show={!context.stateApp.loaded}>
	<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x030306} />
	<MainContainer>
		<Container
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * 0.5}
		>
			<Rectangle
				anchor={0.5}
				y={-36}
				width={520}
				height={160}
				backgroundColor={0x090910}
				borderColor={0xd5a23b}
				borderWidth={7}
				borderRadius={28}
			/>
			<Text
				anchor={0.5}
				y={-56}
				text="GOLDEN"
				style={{
					fontFamily: 'proxima-nova',
					fontSize: 54,
					fontWeight: '800',
					fill: 0xf4d276,
					align: 'center',
				}}
			/>
			<Text
				anchor={0.5}
				y={8}
				text="GOAL RUSH"
				style={{
					fontFamily: 'proxima-nova',
					fontSize: 48,
					fontWeight: '800',
					fill: 0xffffff,
					align: 'center',
				}}
			/>
			<Rectangle
				anchor={0.5}
				y={76}
				width={360}
				height={6}
				backgroundColor={0xc5192e}
				borderRadius={6}
			/>
			<Rectangle
				anchor={0.5}
				y={180}
				width={420}
				height={32}
				backgroundColor={0x001c38}
				borderColor={0xf4d276}
				borderWidth={4}
				borderRadius={18}
			/>
			<Rectangle
				anchor={{ x: 0, y: 0.5 }}
				x={-204}
				y={180}
				width={408 * (context.stateApp.loadingProgress / 100)}
				height={20}
				backgroundColor={0x12a84a}
				borderRadius={12}
			/>
			<Text
				anchor={0.5}
				y={228}
				text="LOADING MATCH"
				style={{
					fontFamily: 'proxima-nova',
					fontSize: 24,
					fontWeight: '800',
					fill: 0xf4d276,
				}}
			/>
		</Container>
	</MainContainer>
</FadeContainer>
