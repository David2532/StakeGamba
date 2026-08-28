import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
	new URL('../src/lib/components/BlacksiteBootSequence.svelte', import.meta.url),
	'utf8',
);
const assetSource = await readFile(
	new URL('../src/lib/assets/blacksite-intro-assets.js', import.meta.url),
	'utf8',
);
const pageSource = await readFile(
	new URL('../src/routes/+page.svelte', import.meta.url),
	'utf8',
);

test('mandatory mission briefing renders the exact V33 rules image and CTA before the slot', () => {
	assert.match(
		assetSource,
		/BLACKSITE_INTRO_MANIFEST_URL\s*=\s*packageAsset\(\s*['"]v33\/intro\/blacksite-startup-manifest-v33\.json['"]\s*,?\s*\)/u,
	);
	assert.match(
		source,
		/data-testid="boot-rules-image"[\s\S]*?src=\{introManifest\.rulesScreen\}/u,
	);
	assert.match(source, /data-testid="mission-briefing"/u);
	assert.match(source, /data-testid="mission-start"[\s\S]*?on:click=\{acceptMission\}/u);
	const rulesImageIndex = source.indexOf('data-testid="boot-rules-image"');
	const missionStartIndex = source.indexOf('data-testid="mission-start"');
	assert.ok(rulesImageIndex >= 0 && missionStartIndex > rulesImageIndex, 'rules image renders before its continue CTA');
	assert.match(source, /showingBriefing = snapshot\.state === BOOT_SEQUENCE_STATE\.MISSION_BRIEFING/u);
});

test('portrait startup preserves the complete authored V33 briefing without cropping', () => {
	assert.match(source, /@media \(max-width: 480px\)[\s\S]*?\.intro-video,[\s\S]*?object-fit:\s*cover/u);
	assert.match(source, /\.boot-start-card \{[\s\S]*?aspect-ratio:\s*1672 \/ 941/u);
	assert.match(source, /\.boot-rules-image \{[\s\S]*?object-fit:\s*contain/u);
	assert.doesNotMatch(source, /\.boot-start-card \{[^}]*height:\s*calc\(100dvh - 16px\)/u);
});

test('component forwards authoritative launch policy and explicitly pauses video when motion is cancelled', () => {
	assert.match(source, /director\.setLaunchContext\(\{ launchKind, activeRound \}\)/u);
	assert.match(
		source,
		/snapshot\.state === BOOT_SEQUENCE_STATE\.INTRO_PLAYING[\s\S]*next\.state !== BOOT_SEQUENCE_STATE\.INTRO_PLAYING[\s\S]*videoElement\?\.pause\?\.\(\)/u,
	);
	assert.match(source, /beginIntro\(\{ durationSeconds: introManifest\.durationSeconds \}\)/u);
});

test('normal live startup has no persisted intro-off bypass in the component or page shell', () => {
	assert.doesNotMatch(source, /export let introOnStartup|startup-intro-disabled|!introOnStartup/u);
	assert.doesNotMatch(pageSource, /blacksite_breach:intro-on-startup:v1/u);
	assert.doesNotMatch(pageSource, /introOnStartup|setIntroOnStartup|toggleIntroOnStartup/u);
	assert.doesNotMatch(pageSource, /game-guide-intro-startup-toggle|settings-intro-startup-toggle/u);
});

test('preload owns a guarded director generation and reports manifest fallback as non-critical failure', () => {
	assert.match(source, /const targetDirector = director;\s*const runGeneration = \+\+startupGeneration;/u);
	assert.match(source, /director === targetDirector[\s\S]*startupGeneration === runGeneration/u);
	assert.match(source, /destroyed = true;\s*startupGeneration \+= 1;/u);
	assert.match(source, /preloadAbortController\?\.abort\(\);[\s\S]*new AbortController\(\)/u);
	assert.match(source, /fetch\(BLACKSITE_INTRO_MANIFEST_URL, \{ cache: 'no-store', signal \}\)/u);
	assert.match(source, /Intro manifest failed to load; poster fallback armed/u);
	assert.match(source, /id: 'intro:manifest',\s*critical: false/u);
});

test('ended video resolves to the mandatory V33 rules image while reduced motion remains static', () => {
	assert.match(source, /showingEndFrame = true;[\s\S]*completeIntroPlayback\(\)/u);
	assert.match(source, /data-testid="boot-rules-image"[\s\S]*src=\{introManifest\.rulesScreen\}/u);
	assert.match(source, /director\.setReducedMotion\(reducedMotion\)/u);
	assert.doesNotMatch(source, /showingBriefing[\s\S]{0,240}gameReady\(\)/u);
});

test('forced replay upgrades the queued READY_FOR_INTRO launch without a competing microtask', () => {
	const replayExport = source.match(/export function replayIntro\(\) \{[\s\S]*?\n\t\}/u)?.[0] ?? '';
	assert.match(replayExport, /pendingIntroForce = true;/u);
	assert.doesNotMatch(replayExport, /queueMicrotask/u);
	assert.match(source, /const force = pendingIntroForce;\s*pendingIntroForce = false;/u);
});
