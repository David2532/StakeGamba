<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { OnHotkey } from 'components-shared';
	import { stateBetDerived } from 'state-shared';

	import ButtonBetProvider from './ButtonBetProvider.svelte';
	import { UI_BASE_FONT_SIZE, UI_BASE_SIZE } from '../constants';

	const props: Partial<Omit<ButtonProps, 'children'>> = $props();
	const disabled = $derived(!stateBetDerived.isBetCostAvailable());
	const sizes = { width: UI_BASE_SIZE * 1.16, height: UI_BASE_SIZE * 1.16 };
</script>

<ButtonBetProvider>
	{#snippet children({ key, onpress })}
		<OnHotkey hotkey="Space" {disabled} {onpress} />
		<Button {...props} {sizes} {onpress} {disabled}>
			{#snippet children({ center })}
				<Container {...center}>
					<Sprite
						key="spinButton"
						width={sizes.width * 1.16}
						height={sizes.height * 1.16}
						anchor={0.5}
						alpha={disabled || ['spin_disabled', 'stop_disabled'].includes(key) ? 0.86 : 1}
					/>
					<Text
						anchor={0.5}
						text={['spin_default', 'spin_disabled'].includes(key) ? 'SPIN' : 'STOP'}
						style={{
							align: 'center',
							wordWrap: true,
							wordWrapWidth: 200,
							fontFamily: 'gold',
							fontWeight: '900',
							fontSize: UI_BASE_FONT_SIZE * 0.72,
							fill: 0xffffff,
						}}
					/>
				</Container>
			{/snippet}
		</Button>
	{/snippet}
</ButtonBetProvider>
