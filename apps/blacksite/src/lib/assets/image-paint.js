function browserFrame(callback) {
	return requestAnimationFrame(callback);
}

/**
 * Decode an image, reveal it through the caller's render system, then wait for
 * two compositor opportunities before exposing screenshot/runtime readiness.
 *
 * @param {HTMLImageElement} image
 * @param {{ reveal?: () => void | Promise<void>, nextFrame?: (callback: FrameRequestCallback) => number }} [options]
 */
export async function waitForDecodedImagePaint(
	image,
	{ reveal = () => {}, nextFrame = browserFrame } = {},
) {
	if (!image?.complete || image.naturalWidth <= 0) {
		throw new Error('IMAGE_NOT_LOADED');
	}
	if (typeof image.decode === 'function') await image.decode();
	if (!image.complete || image.naturalWidth <= 0) {
		throw new Error('IMAGE_DECODE_FAILED');
	}

	await reveal();
	await new Promise((resolve) => nextFrame(() => resolve()));
	await new Promise((resolve) => nextFrame(() => resolve()));
}
