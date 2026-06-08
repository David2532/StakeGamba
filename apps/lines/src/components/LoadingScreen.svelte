<script lang="ts">
	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer, LoadingProgress } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import TransitionAnimation from './TransitionAnimation.svelte';
	import PressToContinue from './PressToContinue.svelte';

	type Props = {
		onloaded: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	let loadingType = $state<'start' | 'transition'>('start');
</script>

<!-- logo and loading progress -->
<FadeContainer show={loadingType === 'start'}>
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
			{#if !context.stateApp.loaded}
				<LoadingProgress y={180} width={1967 * 0.2} height={346 * 0.2}>
					{#snippet background(sizes)}
						<Sprite key="progressBarBackground.png" {...sizes} />
					{/snippet}
					{#snippet progress(sizes)}
						<Sprite key="progressBar.png" {...sizes} />
					{/snippet}
					{#snippet frame(sizes)}
						<Sprite key="progressBarFrame.png" {...sizes} />
					{/snippet}
				</LoadingProgress>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

<!-- press to continue -->
<FadeContainer show={loadingType === 'start' && context.stateApp.loaded}>
	<PressToContinue onpress={() => (loadingType = 'transition')} />
</FadeContainer>

<!-- transition between the loading screen and the game -->
<FadeContainer show={loadingType === 'transition'}>
	<TransitionAnimation oncomplete={props.onloaded} />
</FadeContainer>
