import assets from './assets';

/**
 * Image-only subset of the game assets for the self-contained Storybook previews
 * (SlotPreview, LeBanditFeature). Audio/font assets are excluded so the preview's
 * asset loader can never hang on a failing audio/font load ("Loading..." freeze).
 */
const assetsPreview = Object.fromEntries(
	Object.entries(assets).filter(([, value]) => {
		const type = (value as { type?: string })?.type;
		return type !== 'audio' && type !== 'font';
	}),
) as typeof assets;

export default assetsPreview;
