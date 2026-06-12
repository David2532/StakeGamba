<script lang="ts">
	import { Circle, Text } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';

	import UiSprite from './UiSprite.svelte';
	import UiButtonScale from './UiButtonScale.svelte';
	import type { ButtonIcon } from '../types';
	import type { Snippet } from 'svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { UI_BASE_FONT_SIZE, UI_THEME } from '../constants';

	type Props = Omit<ButtonProps, 'children'> & {
		icon: ButtonIcon;
		sizes: { width: number; height: number };
		active?: boolean;
		children?: Snippet;
		variant?: 'dark' | 'light';
	};

	const {
		icon,
		active,
		variant = 'dark',
		children: childrenFromParent,
		...buttonProps
	}: Props = $props();
</script>

<Button {...buttonProps}>
	{#snippet children({ center, hovered, pressed })}
		{@const disabled = buttonProps.disabled}

		<UiButtonScale x={center.x} y={center.y} {hovered} {pressed}>
			{#if active && !disabled}
				<Circle
					anchor={0.5}
					diameter={Math.max(buttonProps.sizes.width, buttonProps.sizes.height) * 1.12}
					backgroundColor={UI_THEME.goldBright}
					backgroundAlpha={0.22}
				/>
			{/if}

			<UiSprite
				anchor={0.5}
				width={buttonProps.sizes.width}
				height={buttonProps.sizes.height}
				backgroundColor={variant === 'dark' ? UI_THEME.panel : UI_THEME.goldBright}
				{...hovered && !disabled
					? {
							borderColor: UI_THEME.goldBright,
							borderWidth: 4,
						}
					: {}}
				{...active && !disabled
					? {
							borderColor: UI_THEME.goldBright,
							borderWidth: 6,
						}
					: {}}
				{...disabled
					? {
							backgroundColor: UI_THEME.disabledFill,
							borderColor: UI_THEME.disabledBorder,
						}
					: {}}
			/>

			<Text
				anchor={0.5}
				text={i18nDerived[icon]()}
				style={{
					align: 'center',
					wordWrap: true,
					wordWrapWidth: 200,
					fontFamily: 'proxima-nova',
					fontWeight: '700',
					fontSize: UI_BASE_FONT_SIZE * 0.9,
					fill: disabled
						? UI_THEME.disabledText
						: variant === 'dark'
							? UI_THEME.textGold
							: UI_THEME.panel,
				}}
			/>
		</UiButtonScale>

		{@render childrenFromParent?.()}
	{/snippet}
</Button>
