import { packageAsset } from './blacksite-assets.js';

const RUNTIME_ROOT = 'runtime-rgba-v1';
const DEV_FX_RUNTIME_ROOT = 'runtime-rgba-dev-fx-v1';

function freezeGeometry(width, height, anchorX, anchorY) {
	return {
		frameSize: Object.freeze({ width, height }),
		anchor: Object.freeze({ x: anchorX, y: anchorY }),
	};
}

function animatedClip(
	group,
	id,
	frameCount,
	fps,
	loop,
	width,
	height,
	anchorX,
	anchorY,
	runtimeRoot = RUNTIME_ROOT,
) {
	const { frameSize, anchor } = freezeGeometry(width, height, anchorX, anchorY);
	return Object.freeze({
		id,
		frames: Object.freeze(Array.from(
			{ length: frameCount },
			(_, index) => packageAsset(
				`${runtimeRoot}/${group}/${id}/rgba/${id}_${String(index).padStart(3, '0')}.webp`,
			),
		)),
		fps,
		loop,
		frameSize,
		anchor,
	});
}

function staticKeypose(id, width, height, anchorX, anchorY) {
	const { frameSize, anchor } = freezeGeometry(width, height, anchorX, anchorY);
	return Object.freeze({
		id,
		frames: Object.freeze([
			packageAsset(`${RUNTIME_ROOT}/static_keyposes/rgba/${id}.webp`),
		]),
		fps: null,
		loop: false,
		frameSize,
		anchor,
	});
}

export const RUNTIME_RGBA_MANIFEST_URL = packageAsset(
	`${RUNTIME_ROOT}/animation_manifest.json`,
);

export const DEV_FX_RUNTIME_MANIFEST_URL = packageAsset(
	`${DEV_FX_RUNTIME_ROOT}/animation_manifest.json`,
);

export const OPERATOR_ANIMATION_CATALOG = Object.freeze({
	idle: animatedClip('runtime_sequences', 'CHAR_IDLE_WATCH', 12, 8, true, 1280, 1024, 310, 1000),
	loss: animatedClip('runtime_sequences', 'CHAR_LOSS_SINGLE', 16, 10, false, 1280, 1024, 310, 1000),
	lossStreak: animatedClip('runtime_sequences', 'CHAR_LOSS_STREAK', 20, 12, false, 1280, 1024, 310, 1000),
	win: animatedClip('runtime_sequences', 'CHAR_WIN_HAPPY', 18, 12, false, 1280, 1024, 310, 1000),
	bigWin: animatedClip('runtime_sequences', 'CHAR_BIG_WIN', 20, 12, false, 1280, 1024, 310, 1000),
	bonus: animatedClip('runtime_sequences', 'CHAR_BONUS_TOSS', 20, 12, false, 1280, 1024, 310, 1000),
	rage: animatedClip('runtime_sequences', 'CHAR_RAGE_PC_SMASH', 24, 14, false, 1280, 1024, 310, 1000),
});

export const OPERATOR_FX_CATALOG = Object.freeze({
	bonusCratePulse: animatedClip('standalone_fx', 'BONUS_CRATE_PULSE', 16, 12, true, 512, 512, 256, 256),
	bonusCrateSpin: animatedClip('standalone_fx', 'BONUS_CRATE_SPIN', 20, 15, true, 512, 512, 256, 256),
	coinBurst: animatedClip('standalone_fx', 'FX_COIN_BURST', 20, 12, false, 1280, 1024, 310, 1000),
	screenImpact: animatedClip('standalone_fx', 'FX_SCREEN_IMPACT', 12, 15, false, 1280, 1024, 310, 1000),
	winFlash: animatedClip('standalone_fx', 'FX_WIN_FLASH', 10, 15, false, 1280, 1024, 310, 1000),
});

// Fixture/V22-only 30 fps delivery pack. The paid/live catalog above remains
// byte-for-byte mapped to runtime-rgba-v1; callers must opt into this export.
export const OPERATOR_FX_DEV_V22_CATALOG = Object.freeze({
	bonusCratePulse: animatedClip(
		'standalone_fx', 'BONUS_CRATE_PULSE_30FPS', 40, 30, true, 512, 512, 256, 256, DEV_FX_RUNTIME_ROOT,
	),
	bonusCrateSpin: animatedClip(
		'standalone_fx', 'BONUS_CRATE_SPIN_30FPS', 40, 30, true, 512, 512, 256, 256, DEV_FX_RUNTIME_ROOT,
	),
	coinBurst: animatedClip(
		'standalone_fx', 'FX_COIN_BURST_30FPS', 50, 30, false, 1280, 1024, 310, 1000, DEV_FX_RUNTIME_ROOT,
	),
	screenImpact: animatedClip(
		'standalone_fx', 'FX_SCREEN_IMPACT_30FPS', 24, 30, false, 1280, 1024, 310, 1000, DEV_FX_RUNTIME_ROOT,
	),
	winFlash: animatedClip(
		'standalone_fx', 'FX_WIN_FLASH_30FPS', 20, 30, false, 1280, 1024, 310, 1000, DEV_FX_RUNTIME_ROOT,
	),
});

export const OPERATOR_STATIC_KEYPOSES = Object.freeze({
	bonusCrate: staticKeypose('BONUS_CRATE_STATIC', 512, 512, 256, 256),
	bonus: staticKeypose('CHAR_POSE_BONUS_TOSS', 1280, 1024, 310, 1000),
	idle: staticKeypose('CHAR_POSE_IDLE', 1280, 1024, 310, 1000),
	loss: staticKeypose('CHAR_POSE_LOSS_FACEPALM', 1280, 1024, 310, 1000),
	lossStreak: staticKeypose('CHAR_POSE_LOSS_STREAK', 1280, 1024, 310, 1000),
	rage: staticKeypose('CHAR_POSE_RAGE_PC_SMASH', 1280, 1024, 310, 1000),
	win: staticKeypose('CHAR_POSE_WIN_HAPPY', 1280, 1024, 310, 1000),
});
