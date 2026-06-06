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
	borderWidth={borderWidth ?? 3}
	borderAlpha={borderAlpha ?? 0.95}
	borderRadius={borderRadius ?? 22}
/>
<Rectangle
	{...props}
	backgroundColor={0xffffff}
	backgroundAlpha={0.06}
	borderColor={0xffe49a}
	borderWidth={1}
	borderAlpha={0.35}
	borderRadius={borderRadius ?? 22}
	scale={0.88}
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
