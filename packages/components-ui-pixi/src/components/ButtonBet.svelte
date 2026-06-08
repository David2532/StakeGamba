<script lang="ts">
	import { Container, Graphics, Text } from 'pixi-svelte';
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
					<Graphics
						alpha={disabled || ['spin_disabled', 'stop_disabled'].includes(key) ? 0.86 : 1}
						draw={(g) => {
							const radius = sizes.width * 0.58;
							const active = !disabled && !['spin_disabled', 'stop_disabled'].includes(key);

							g.circle(0, 0, radius);
							g.fill({ color: active ? 0x15110a : 0x5c5c58, alpha: active ? 0.98 : 0.94 });
							g.stroke({ color: 0xf4ca61, width: 8, alpha: 1 });

							g.circle(0, 0, radius * 0.84);
							g.stroke({ color: 0xfff1a4, width: 2, alpha: 0.7 });

							g.circle(-radius * 0.2, -radius * 0.26, radius * 0.52);
							g.fill({ color: 0xffffff, alpha: active ? 0.08 : 0.05 });
						}}
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
