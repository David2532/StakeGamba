<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		onpress: () => void;
	};

	const props: Props = $props();
	const context = getContext();
</script>

<MainContainer alignVertical="bottom">
	<Container
		x={context.stateLayoutDerived.mainLayout().width * 0.5}
		y={context.stateLayoutDerived.mainLayout().height - 28}
	>
		<Rectangle
			anchor={{ x: 0.5, y: 1 }}
			width={520}
			height={68}
			backgroundColor={0x03162f}
			backgroundAlpha={0.9}
			borderColor={0xffd447}
			borderWidth={4}
			borderRadius={34}
		/>
		<Text
			anchor={{ x: 0.5, y: 1 }}
			y={-16}
			text="CLICK TO KICK OFF"
			style={{
				fontFamily: 'proxima-nova',
				fontSize: 30,
				fontWeight: '900',
				fill: 0xffffff,
				align: 'center',
				letterSpacing: 1,
			}}
		/>
	</Container>
</MainContainer>
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
