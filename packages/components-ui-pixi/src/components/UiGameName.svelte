<script lang="ts">
	import { SvelteDate } from 'svelte/reactivity';

	import { Text, REM } from 'pixi-svelte';

	type Props = {
		name: string;
	};

	const props: Props = $props();
	const reactiveDate = new SvelteDate();
	const clock = $derived(
		reactiveDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			hour12: false,
		}),
	);
	const textProps = {
		style: {
			fontFamily: 'proxima-nova',
			fontSize: REM * 1.35,
			fontWeight: '800',
			lineHeight: REM * 2,
			fill: 0xf4d276,
		},
	} as const;

	let clockSizes = $state({ width: 0, height: 0 });

	$effect(() => {
		const interval = setInterval(() => {
			reactiveDate.setTime(Date.now());
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<Text text={clock} onresize={(value) => (clockSizes = value)} {...textProps} />
<Text text={props.name} x={clockSizes.width + 5} {...textProps} />
