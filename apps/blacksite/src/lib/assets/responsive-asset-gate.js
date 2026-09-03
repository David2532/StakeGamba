export const COMPACT_CHARACTER_MEDIA_QUERY = '(max-width: 820px), (max-height: 560px)';

/**
 * Keep the decorative character out of compact compositions entirely. CSS-only
 * hiding still downloads and decodes the large image, so the render decision
 * must follow the same media contract as the layout.
 *
 * @param {Pick<Window, 'matchMedia'>} windowRef
 * @param {(visible: boolean) => void} onVisibility
 * @returns {() => void}
 */
export function watchCharacterAssetVisibility(windowRef, onVisibility) {
	const compactQuery = windowRef.matchMedia(COMPACT_CHARACTER_MEDIA_QUERY);
	const sync = () => onVisibility(!compactQuery.matches);

	sync();
	compactQuery.addEventListener('change', sync);
	return () => compactQuery.removeEventListener('change', sync);
}
