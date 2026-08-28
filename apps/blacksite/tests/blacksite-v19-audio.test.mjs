import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	BLACKSITE_AUDIO_ASSETS,
	BLACKSITE_AUDIO_CUES,
	BLACKSITE_AUDIO_LEGACY_ALIASES,
	BLACKSITE_AUDIO_STORAGE_KEY,
	BlacksiteAudioDirector,
	blacksiteAudioAsset,
} from '../src/lib/runtime/blacksite-audio-director.js';

const audioSource = await readFile(new URL('../src/lib/runtime/blacksite-audio-director.js', import.meta.url), 'utf8');
const cinematicSource = await readFile(new URL('../src/lib/runtime/vault-cinematic-director.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

test('legacy V19 asset export remains package-contract compatible during RuntimePack migration', () => {
	assert.equal(blacksiteAudioAsset('base-ambience.mp3'), 'assets/blacksite/audio/v19/base-ambience.mp3');
	assert.deepEqual(BLACKSITE_AUDIO_ASSETS, {
		baseAmbience: 'assets/blacksite/audio/v19/base-ambience.mp3',
		featureAward: 'assets/blacksite/audio/v19/free-spins-award.mp3',
		vaultAnticipation: 'assets/blacksite/audio/v19/vault-anticipation.mp3',
	});
});

test('all currently emitted V19 names remain closed aliases or curated runtime cues', () => {
	assert.equal(Object.keys(BLACKSITE_AUDIO_LEGACY_ALIASES).length, 23);
	assert.equal(BLACKSITE_AUDIO_CUES.length, 105, '76 curated cues + 23 direct aliases + 6 semantic sequences');
	for (const target of Object.values(BLACKSITE_AUDIO_LEGACY_ALIASES)) {
		assert.ok(BLACKSITE_AUDIO_CUES.includes(target), `legacy target ${target} is a curated runtime cue`);
	}
	const emittedCues = new Set([
		...[...cinematicSource.matchAll(/cue:\s*['"]([^'"]+)['"]/gu)].map((match) => match[1]),
		...[...cinematicSource.matchAll(/#audio\(['"]([^'"]+)['"]\)/gu)].map((match) => match[1]),
		...[...pageSource.matchAll(/audioDirector\?\.play\(['"]([^'"]+)['"]\)/gu)].map((match) => match[1]),
	]);
	if (/turboEnabled \? 'reel-stop-turbo' : 'reel-stop'/u.test(pageSource)) {
		emittedCues.add('reel-stop');
		emittedCues.add('reel-stop-turbo');
	}
	for (const cue of emittedCues) assert.ok(BLACKSITE_AUDIO_CUES.includes(cue), `unregistered emitted cue ${cue}`);
	for (const cue of ['ui-confirm', 'ui-open', 'ui-select', 'spin-start', 'win', 'loss', 'extraction', 'return-base']) {
		assert.ok(BLACKSITE_AUDIO_LEGACY_ALIASES[cue], `missing legacy alias ${cue}`);
	}
	for (const cue of ['reel-stop', 'reel-stop-turbo', 'vault-locks-release', 'vault-door-open', 'vault-light-entry']) {
		assert.ok(BLACKSITE_AUDIO_CUES.includes(cue), `missing legacy semantic sequence ${cue}`);
	}
});

test('legacy calls are accepted as cosmetic schedules without requiring V19 media elements', () => {
	const director = new BlacksiteAudioDirector({
		storage: null,
		AudioContextClass: null,
		AudioClass: null,
		fetchFn: null,
		autoPreload: false,
	});
	for (const cue of ['ui-confirm', 'spin-start', 'reel-stop', 'vault-locks-release', 'vault-door-open', 'win', 'loss']) {
		assert.equal(director.play(cue), true, `${cue} remains accepted during wiring migration`);
	}
	assert.equal(director.play('not-a-cue'), false);
	director.destroy();
});

test('persisted global mute keeps all legacy and curated schedules silent', () => {
	const values = new Map([[BLACKSITE_AUDIO_STORAGE_KEY, '1']]);
	const storage = {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
	};
	const director = new BlacksiteAudioDirector({ storage, AudioContextClass: null, autoPreload: false });
	assert.equal(director.snapshot().muted, true);
	assert.equal(director.play('spin-start'), false);
	assert.equal(director.toggleMuted().muted, false);
	assert.equal(values.get(BLACKSITE_AUDIO_STORAGE_KEY), '0');
	assert.equal(director.toggleMuted().muted, true);
	assert.equal(values.get(BLACKSITE_AUDIO_STORAGE_KEY), '1');
	director.destroy();
});

test('audio module has no math, wallet, random-result, or RGS authority', () => {
	assert.doesNotMatch(
		audioSource,
		/Math\.random|crypto\.getRandomValues|live-session|rgs-client|authenticate|end-round|wallet|payout|freeSpins|\/play\b/iu,
	);
});
