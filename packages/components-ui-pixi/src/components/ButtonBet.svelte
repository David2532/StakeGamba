<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { Container, Circle, Graphics } from 'pixi-svelte';
	import { Button, type ButtonProps } from 'components-pixi';
	import { OnHotkey } from 'components-shared';
	import { stateBetDerived } from 'state-shared';

	import ButtonBetProvider from './ButtonBetProvider.svelte';
	import UiButtonScale from './UiButtonScale.svelte';
	import { UI_BASE_SIZE, UI_THEME } from '../constants';

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

	const pulseAlpha = $derived(0.18 + 0.14 * Math.sin(time * 0.004));
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
							diameter={sizes.width * 1.22}
							backgroundColor={UI_THEME.emeraldBright}
							backgroundAlpha={pulseAlpha}
						/>
					{/if}

					<UiButtonScale x={center.x} y={center.y} {hovered} {pressed}>
						<Circle
							anchor={0.5}
							diameter={sizes.width}
							backgroundColor={inactive ? UI_THEME.disabledFill : UI_THEME.emeraldDark}
							borderColor={errorFlash
								? UI_THEME.errorRed
								: inactive
									? UI_THEME.disabledBorder
									: hovered
										? UI_THEME.goldBright
										: UI_THEME.gold}
							borderWidth={errorFlash ? 10 : 7}
						/>
						<Circle
							anchor={0.5}
							diameter={sizes.width * 0.84}
							backgroundColor={inactive ? UI_THEME.disabledFill : UI_THEME.emerald}
							backgroundAlpha={inactive ? 0.4 : 0.55}
						/>

						{#if spinning}
							<!-- Stop square + rotating rotor ring while the reels are spinning. -->
							<Graphics
								draw={(graphics) => {
									const s = sizes.width * 0.2;
									graphics.roundRect(-s, -s, s * 2, s * 2, s * 0.3);
									graphics.fill({ color: key === 'stop_disabled' ? UI_THEME.disabledText : 0xffffff });
								}}
							/>
							<Container rotation={rotorRotation}>
								<Graphics
									draw={(graphics) => {
										graphics.arc(0, 0, radius * 0.92, 0, Math.PI * 1.4);
										graphics.stroke({
											color: UI_THEME.electricBlue,
											width: 6,
											alpha: key === 'stop_disabled' ? 0.4 : 0.9,
										});
									}}
								/>
							</Container>
						{:else}
							<!-- Play-arrow spin icon. -->
							<Graphics
								draw={(graphics) => {
									const s = sizes.width * 0.24;
									graphics.moveTo(-s * 0.6, -s);
									graphics.lineTo(s, 0);
									graphics.lineTo(-s * 0.6, s);
									graphics.closePath();
									graphics.fill({
										color: inactive ? UI_THEME.disabledText : UI_THEME.goldBright,
									});
								}}
							/>
						{/if}
					</UiButtonScale>
				{/snippet}
			</Button>
		</Container>
	{/snippet}
</ButtonBetProvider>
