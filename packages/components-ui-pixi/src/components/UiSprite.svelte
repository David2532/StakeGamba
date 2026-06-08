<script lang="ts" module>
	import { Rectangle, type RectangleProps } from 'pixi-svelte';

	export type Props = RectangleProps;
</script>

<script lang="ts">
	const {
		backgroundColor,
		backgroundAlpha,
		borderColor,
		borderWidth,
		borderAlpha,
		borderRadius,
		...props
	}: Props = $props();
</script>

<Rectangle
	{...props}
	backgroundColor={backgroundColor ?? 0x08080d}
	backgroundAlpha={backgroundAlpha ?? 0.96}
	borderColor={borderColor ?? 0xd5a23b}
	borderWidth={borderWidth ?? 4}
	borderAlpha={borderAlpha ?? 0.95}
	borderRadius={borderRadius ?? 16}
/>
<Rectangle
	{...props}
	backgroundColor={0xf2c64c}
	backgroundAlpha={0.08}
	borderColor={0xffe49a}
	borderWidth={1}
	borderAlpha={0.28}
	borderRadius={borderRadius ?? 12}
	scale={0.9}
/>

<!-- <script lang="ts" module>
	import { Sprite, type SpriteProps } from 'pixi-svelte';
	import type { sharedAssetsPixi } from 'constants-shared/assets';

	export type Props = SpriteProps & {
		key: keyof typeof sharedAssetsPixi;
	};
</script>

<script lang="ts">
	const props: Props = $props();
</script>

<Sprite {...props} /> -->
