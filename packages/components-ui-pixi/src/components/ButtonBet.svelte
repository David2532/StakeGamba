<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { Container, Circle, Graphics, Text } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { OnHotkey } from 'components-shared';
	import { stateBetDerived } from 'state-shared';

	import ButtonBetProvider from './ButtonBetProvider.svelte';
	import UiButtonScale from './UiButtonScale.svelte';
	import { UI_BASE_FONT_SIZE, UI_BASE_SIZE, UI_THEME } from '../constants';

	const props: Partial<Omit<ButtonProps, 'children'>> = $props();
	const disabled = $derived(!stateBetDerived.isBetCostAvailable());
	const sizes = { width: UI_BASE_SIZE * 1.16, height: UI_BASE_SIZE * 1.16 };
	const radius = sizes.width * 0.5;

	// One animation clock drives the idle glow pulse and the spinning rotor ring.
	let time = $state(0);
	$effect(() => {
		let frame: number;
		const loop = (now: number) => {
			time = now;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});

	const pulseAlpha = $derived(0.16 + 0.12 * Math.sin(time * 0.004));
	const rotorRotation = $derived((time * 0.006) % (Math.PI * 2));

	// Error feedback when the player tries to spin without enough balance.
	const shakeTween = new Tween(0, { duration: 45 });
	let errorFlash = $state(false);
	let shaking = false;
	const shake = async () => {
		if (shaking) return;
		shaking = true;
		errorFlash = true;
		for (const dx of [-14, 12, -9, 6, -3, 0]) await shakeTween.set(dx);
		errorFlash = false;
		shaking = false;
	};
</script>

<ButtonBetProvider>
	{#snippet children({ key, onpress })}
		{@const spinning = key === 'stop_default' || key === 'stop_disabled'}
		{@const inactive = disabled || key === 'spin_disabled' || key === 'stop_disabled'}
		<OnHotkey hotkey="Space" {disabled} {onpress} />
		<Container
			x={shakeTween.current}
			eventMode="static"
			onpointerdown={() => {
				if (disabled && !spinning) shake();
			}}
		>
			<Button {...props} {sizes} {onpress} {disabled}>
				{#snippet children({ center, hovered, pressed })}
					{#if !inactive && !spinning}
						<Circle
							{...center}
							anchor={0.5}
							diameter={sizes.width * 1.24}
							backgroundColor={UI_THEME.goldBright}
							backgroundAlpha={pulseAlpha}
						/>
					{/if}

					<UiButtonScale x={center.x} y={center.y} {hovered} {pressed}>
						<!-- Thick gold ring with dark center, after the final game mockup. -->
						<Circle
							anchor={0.5}
							diameter={sizes.width}
							backgroundColor={inactive ? UI_THEME.disabledFill : UI_THEME.panel}
							borderColor={errorFlash
								? UI_THEME.errorRed
								: inactive
									? UI_THEME.disabledBorder
									: hovered
										? UI_THEME.goldBright
										: UI_THEME.gold}
							borderWidth={errorFlash ? 14 : 12}
						/>
						<Circle
							anchor={0.5}
							diameter={sizes.width * 0.78}
							backgroundColor={inactive ? UI_THEME.disabledFill : UI_THEME.panelInner}
							borderColor={inactive ? UI_THEME.disabledBorder : UI_THEME.gold}
							borderWidth={2}
						/>

						<Text
							anchor={0.5}
							text={spinning ? 'STOP' : 'SPIN'}
							style={{
								align: 'center',
								fontFamily: 'proxima-nova',
								fontWeight: '800',
								letterSpacing: 2,
								fontSize: UI_BASE_FONT_SIZE * 0.95,
								fill: inactive ? UI_THEME.disabledText : UI_THEME.textGold,
							}}
						/>

						{#if spinning}
							<!-- Rotating rotor ring while the reels are spinning. -->
							<Container rotation={rotorRotation}>
								<Graphics
									draw={(graphics) => {
										graphics.arc(0, 0, radius * 0.92, 0, Math.PI * 1.4);
										graphics.stroke({
											color: UI_THEME.goldBright,
											width: 6,
											alpha: key === 'stop_disabled' ? 0.4 : 0.9,
										});
									}}
								/>
							</Container>
						{/if}
					</UiButtonScale>
				{/snippet}
			</Button>
		</Container>
	{/snippet}
</ButtonBetProvider>
