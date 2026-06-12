<script lang="ts">
	import { Circle, Text } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { stateModal, stateBet, stateBetDerived, stateMetaDerived } from 'state-shared';

	import UiSprite from './UiSprite.svelte';
	import UiButtonScale from './UiButtonScale.svelte';
	import { UI_BASE_FONT_SIZE, UI_BASE_SIZE, UI_THEME } from '../constants';
	import { getContext } from '../context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const props: Partial<Omit<ButtonProps, 'children'>> = $props();
	const { stateXstateDerived, eventEmitter } = getContext();
	const sizes = { width: UI_BASE_SIZE, height: UI_BASE_SIZE };
	const active = $derived(stateBetDerived.activeBetMode()?.type === 'activate');

	// Cheapest buyable bonus mode decides whether the player can afford a buy at all.
	const minBuyCostMultiplier = $derived.by(() => {
		const buyModes = stateMetaDerived.betModeMetaList().filter((mode) => mode.type === 'buy');
		if (buyModes.length === 0) return null;
		return Math.min(...buyModes.map((mode) => mode.costMultiplier));
	});
	const canAffordBuy = $derived(
		minBuyCostMultiplier === null ||
			stateBet.betAmount * minBuyCostMultiplier <= stateBet.balanceAmount,
	);
	const disabled = $derived(!stateXstateDerived.isIdle() || (!active && !canAffordBuy));

	const openModal = () => (stateModal.modal = { name: 'buyBonus' });
	const disableActiveBetMode = () => (stateBet.activeBetModeKey = 'BASE');
	const onpress = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });

		if (active) {
			disableActiveBetMode();
		} else {
			openModal();
		}
	};

	const getState = (value: {
		active: boolean;
		disabled: boolean;
		hovered: boolean;
		pressed: boolean;
	}) => {
		if (value.disabled) return 'disabled' as const;
		if (value.pressed) return 'pressed' as const;
		if (value.hovered) return 'hovered' as const;
		if (value.active) return 'active' as const;
		return 'default' as const;
	};
</script>

<Button {...props} {sizes} {disabled} {onpress}>
	{#snippet children({ center, hovered, pressed })}
		{@const state = getState({
			active,
			disabled,
			hovered,
			pressed,
		})}

		<UiButtonScale x={center.x} y={center.y} {hovered} {pressed}>
			{#if state === 'hovered' || state === 'active'}
				<Circle
					anchor={0.5}
					diameter={Math.max(sizes.width, sizes.height) * 1.16}
					backgroundColor={UI_THEME.goldBright}
					backgroundAlpha={0.25}
				/>
			{/if}

			<UiSprite
				anchor={0.5}
				width={sizes.width}
				height={sizes.height}
				backgroundColor={UI_THEME.panel}
				{...state === 'hovered'
					? {
							borderColor: UI_THEME.goldBright,
							borderWidth: 4,
						}
					: {}}
				{...state === 'active'
					? {
							borderColor: UI_THEME.goldBright,
							borderWidth: 6,
						}
					: {}}
				{...state === 'disabled'
					? {
							backgroundColor: UI_THEME.disabledFill,
							borderColor: UI_THEME.disabledBorder,
						}
					: {}}
			/>

			<Text
				anchor={0.5}
				text={state === 'active' ? i18nDerived.disable() : i18nDerived.buyBonus()}
				style={{
					align: 'center',
					wordWrap: true,
					wordWrapWidth: 200,
					fontFamily: 'proxima-nova',
					fontWeight: '600',
					fontSize: UI_BASE_FONT_SIZE * 0.9,
					fill: state === 'disabled' ? UI_THEME.disabledText : UI_THEME.textGold,
				}}
			/>
		</UiButtonScale>
	{/snippet}
</Button>
