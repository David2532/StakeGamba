import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	BLACKSITE_AUDIO_RUNTIMEPACK_BANKS,
	BLACKSITE_AUDIO_RUNTIMEPACK_BUSES,
	BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG,
	BLACKSITE_AUDIO_RUNTIMEPACK_CUES,
	BLACKSITE_AUDIO_RUNTIMEPACK_FILES,
} from '../src/lib/assets/blacksite-audio-v28.js';
import { BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA } from '../src/lib/assets/blacksite-audio-runtimepack-v1.generated.js';
import {
	BlacksiteAudioDirector,
	blacksiteAudioEventKey,
	deterministicAudioVariant,
} from '../src/lib/runtime/blacksite-audio-director.js';

const appRoot = new URL('../', import.meta.url);
const selection = JSON.parse(await readFile(new URL('art/audio/runtimepack-v1/selection.json', appRoot), 'utf8'));
const importReport = JSON.parse(await readFile(new URL('art/audio/runtimepack-v1/IMPORT_REPORT.json', appRoot), 'utf8'));
const sourceManifest = JSON.parse(await readFile(new URL('art/audio/runtimepack-v1/source-audio-manifest.json', appRoot), 'utf8'));
const runtimeManifest = JSON.parse(await readFile(new URL('static/assets/blacksite/v29/audio/audio-manifest.json', appRoot), 'utf8'));
const licenseSummary = await readFile(new URL('art/audio/runtimepack-v1/LICENSE_SUMMARY.md', appRoot), 'utf8');
const sourcesCsv = await readFile(new URL('art/audio/runtimepack-v1/SOURCES.csv', appRoot), 'utf8');
const curatedAssetMapCsv = await readFile(new URL('art/audio/runtimepack-v1/CURATED_ASSET_MAP.csv', appRoot), 'utf8');
const excludedSources = await readFile(new URL('art/audio/runtimepack-v1/EXCLUDED_SOURCES.md', appRoot), 'utf8');
const legalCode = await readFile(new URL('art/audio/runtimepack-v1/CC0-1.0-LEGALCODE.txt', appRoot), 'utf8');
const directorSource = await readFile(new URL('../src/lib/runtime/blacksite-audio-director.js', import.meta.url), 'utf8');

function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

function selectedOriginalPath(sourceFile) {
	return `art/audio/runtimepack-v1/selected-originals/${sourceFile.replace('01_RUNTIME_READY/audio/', '')}`;
}

function runtimeStaticPath(runtimePath) {
	return `static/${runtimePath}`;
}

class FakeAudioParam {
	constructor(value = 0) {
		this.value = value;
		this.events = [];
	}

	setValueAtTime(value, time) {
		this.value = value;
		this.events.push(['set', value, time]);
	}

	linearRampToValueAtTime(value, time) {
		this.value = value;
		this.events.push(['linear', value, time]);
	}

	cancelScheduledValues(time) {
		this.events.push(['cancel', time]);
	}
}

class FakeNode {
	connect(destination) {
		this.destination = destination;
		return destination;
	}
}

class FakeGain extends FakeNode {
	constructor() {
		super();
		this.gain = new FakeAudioParam(1);
	}
}

class FakeBufferSource extends FakeNode {
	constructor() {
		super();
		this.events = new Map();
		this.loop = false;
	}

	addEventListener(name, handler) {
		this.events.set(name, handler);
	}

	start(time) {
		this.startTime = time;
	}

	stop(time) {
		this.stopTime = time;
		this.events.get('ended')?.();
	}
}

class FakePanner extends FakeNode {
	pan = new FakeAudioParam();
}

class FakeCompressor extends FakeNode {
	threshold = new FakeAudioParam();
	knee = new FakeAudioParam();
	ratio = new FakeAudioParam();
	attack = new FakeAudioParam();
	release = new FakeAudioParam();
}

class FakeAudioContext {
	static instances = [];

	constructor() {
		this.state = 'suspended';
		this.currentTime = 1;
		this.destination = {};
		this.gains = [];
		this.sources = [];
		this.panners = [];
		FakeAudioContext.instances.push(this);
	}

	createGain() {
		const gain = new FakeGain();
		this.gains.push(gain);
		return gain;
	}

	createBufferSource() {
		const source = new FakeBufferSource();
		this.sources.push(source);
		return source;
	}

	createStereoPanner() {
		const panner = new FakePanner();
		this.panners.push(panner);
		return panner;
	}

	createDynamicsCompressor() {
		this.compressor = new FakeCompressor();
		return this.compressor;
	}

	async resume() {
		this.resumeCalls = (this.resumeCalls ?? 0) + 1;
		this.state = 'running';
	}

	async suspend() {
		this.suspendCalls = (this.suspendCalls ?? 0) + 1;
		this.state = 'suspended';
	}

	async close() {
		this.closed = true;
		this.state = 'closed';
	}
}

class FakeDocument {
	visibilityState = 'visible';
	listeners = new Map();

	addEventListener(name, listener) {
		this.listeners.set(name, listener);
	}

	removeEventListener(name, listener) {
		if (this.listeners.get(name) === listener) this.listeners.delete(name);
	}

	setVisibility(state) {
		this.visibilityState = state;
		this.listeners.get('visibilitychange')?.();
	}
}

const fakeBuffer = Object.freeze({ duration: 0.25 });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function makeDirector(overrides = {}) {
	return new BlacksiteAudioDirector({
		storage: null,
		AudioContextClass: FakeAudioContext,
		assetLoader: async () => fakeBuffer,
		fetchFn: null,
		autoPreload: false,
		...overrides,
	});
}

test('curated runtime pack closes 76 semantic cues across six buses and 121 byte-preserved V29 files', () => {
	assert.deepEqual(Object.keys(BLACKSITE_AUDIO_RUNTIMEPACK_BUSES), ['Music', 'Ambience', 'Reels', 'Wins', 'UI', 'Voice']);
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_CUES.length, 76);
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_FILES.length, 121);
	assert.equal(new Set(BLACKSITE_AUDIO_RUNTIMEPACK_FILES).size, 121);
	assert.deepEqual(Object.keys(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG), BLACKSITE_AUDIO_RUNTIMEPACK_CUES);
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.schema, 'blacksite-audio-runtime-catalog-v29');
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot, 'assets/blacksite/v29/audio');
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.cues.length, 76);
	for (const cueId of BLACKSITE_AUDIO_RUNTIMEPACK_CUES) {
		const cue = BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId];
		assert.ok(BLACKSITE_AUDIO_RUNTIMEPACK_BUSES[cue.bus], `${cueId} has a named bus`);
		assert.ok(BLACKSITE_AUDIO_RUNTIMEPACK_BANKS[cue.bank].includes(cueId), `${cueId} has a preload bank`);
		assert.equal(typeof cue.sourceEvent, 'string', `${cueId} keeps its supplied-pack event mapping`);
		assert.ok(cue.files.every((path) => path.startsWith('assets/blacksite/v29/audio/')), `${cueId} uses V29`);
		assert.ok(cue.files.every((path) => /\.(?:flac|ogg|opus|wav)$/u.test(path)), `${cueId} has a supported runtime extension`);
	}
});

test('required vertical slice includes spatial stops, tiers, Foley, BLACKOUT, expansion, summary and every Vault phase', () => {
	const required = [
		'ui.press', 'ui.confirm', 'ui.deny', 'spin.confirmed', 'reels.turbo.attack', 'reels.motor.loop',
		...Array.from({ length: 5 }, (_, index) => `reel.stop.${index + 1}`),
		'symbol.land.regular', 'symbol.land.high', 'symbol.land.ghost_wild', 'breach.land.1', 'breach.land.2', 'breach.trigger',
		'win.micro', 'win.small', 'win.medium', 'win.big', 'win.top', 'win.max', 'round.loss',
		'operative.spin', 'operative.win', 'operative.bonus', 'operative.recover',
		'vault.hold', 'vault.focus', ...Array.from({ length: 6 }, (_, index) => `vault.lock.${index + 1}`),
		'vault.wheel', 'vault.pressure', 'vault.bolts', 'vault.door', 'vault.door.impact', 'vault.gold', 'vault.camera', 'vault.handoff',
		'music.blackout', 'feature.expand.attack', 'feature.expand.reel', 'feature.expand.settle',
		'feature.summary.open', 'feature.summary.close',
	];
	for (const cueId of required) assert.ok(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId], `missing ${cueId}`);
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG['ambience.base'], undefined, 'rejected base drone is not shipped');
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG['music.base'], undefined, 'base scene remains intentionally silent');
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG['ambience.blackout'], undefined, 'BLACKOUT does not stack a constant ambience drone');
	assert.deepEqual(
		Array.from({ length: 5 }, (_, index) => BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[`reel.stop.${index + 1}`].pan),
		[-0.8, -0.4, 0, 0.4, 0.8],
	);
});

test('import manifests prove exact selected encodes, hashes, formats and runtime budgets', async () => {
	assert.equal(selection.schema, 'blacksite-audio-runtimepack-selection-v1');
	assert.equal(selection.runtimeRoot, 'assets/blacksite/v29/audio');
	assert.equal(selection.selectionPolicy.baseScene, 'silent');
	assert.match(selection.selectionPolicy.blackoutScene, /music-only/u);
	assert.equal(selection.cues.length, 76);
	assert.equal(importReport.schema, 'blacksite-audio-runtimepack-import-report-v1');
	assert.equal(importReport.status, 'PASS');
	assert.equal(importReport.bytePreserved, true);
	assert.equal(importReport.audibleQa, 'PENDING_USER_AND_DEVICE_AUDITION');
	assert.equal(importReport.cueCount, 76);
	assert.equal(importReport.fileCount, 121);
	assert.equal(importReport.runtimeBytes, 3_236_044);
	assert.equal(importReport.criticalRuntimeBytes, 980_633);
	assert.deepEqual(importReport.typeCounts, { '.flac': 1, '.ogg': 102, '.opus': 1, '.wav': 17 });

	assert.equal(runtimeManifest.schema, 'blacksite-audio-runtime-manifest-v29');
	assert.equal(runtimeManifest.status, 'TECHNICAL_IMPORT_PASS_AUDIBLE_QA_PENDING');
	assert.equal(runtimeManifest.runtimeRoot, selection.runtimeRoot);
	assert.deepEqual(runtimeManifest.budgets, {
		runtimeBytes: 3_236_044,
		criticalRuntimeBytes: 980_633,
		hardMaxRuntimeBytes: 8 * 1024 * 1024,
		pass: true,
	});
	assert.deepEqual(runtimeManifest.typeCounts, importReport.typeCounts);
	assert.equal(runtimeManifest.cues.length, BLACKSITE_AUDIO_RUNTIMEPACK_CUES.length);
	assert.equal(runtimeManifest.files.length, 121);
	assert.equal(new Set(runtimeManifest.files.map((row) => row.path)).size, 121);
	assert.deepEqual(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.cues, runtimeManifest.cues);

	const selectionByCue = new Map(selection.cues.map((cue) => [cue.cueId, cue]));
	for (const row of runtimeManifest.cues) {
		const selectedCue = selectionByCue.get(row.cueId);
		const sourceEvent = sourceManifest.events[row.sourceEvent];
		const catalogCue = BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[row.cueId];
		assert.ok(selectedCue, `selection contains ${row.cueId}`);
		assert.ok(sourceEvent, `source manifest contains ${row.sourceEvent}`);
		assert.ok(catalogCue, `runtime catalog contains ${row.cueId}`);
		const expectedSourceVariants = selectedCue.variantIndexes.map((index) => sourceEvent.variants[index]);
		assert.ok(expectedSourceVariants.every(Boolean), `${row.cueId} selects valid source variant indexes`);
		assert.deepEqual(
			row.runtimeFiles,
			expectedSourceVariants.map((variant) => variant.file.replace('01_RUNTIME_READY/audio/', `${selection.runtimeRoot}/`)),
			`${row.cueId} resolves to its explicitly selected source variants`,
		);
		assert.deepEqual({
			sourceEvent: row.sourceEvent,
			bus: row.bus,
			bank: row.bank,
			priority: row.priority,
			loop: row.loop,
			pan: row.pan,
			protected: row.protected,
			duck: row.duck,
			files: row.runtimeFiles,
		}, {
			sourceEvent: catalogCue.sourceEvent,
			bus: catalogCue.bus,
			bank: catalogCue.bank,
			priority: catalogCue.priority,
			loop: catalogCue.loop,
			pan: catalogCue.pan,
			protected: catalogCue.protected,
			duck: catalogCue.duck,
			files: catalogCue.files,
		});
	}

	const sourceVariantByFile = new Map(Object.values(sourceManifest.events)
		.flatMap((event) => event.variants)
		.map((variant) => [variant.file, variant]));
	const runtimeFileByPath = new Map(runtimeManifest.files.map((row) => [row.path, row]));
	let runtimeBytes = 0;
	for (const row of runtimeManifest.files) {
		const runtime = await readFile(new URL(runtimeStaticPath(row.path), appRoot));
		const selectedOriginal = await readFile(new URL(selectedOriginalPath(row.sourceFile), appRoot));
		const sourceVariant = sourceVariantByFile.get(row.sourceFile);
		runtimeBytes += runtime.byteLength;
		assert.ok(sourceVariant, `${row.sourceFile} exists in the supplied source manifest`);
		assert.equal(runtime.byteLength, row.bytes, `${row.path} byte count`);
		assert.equal(sha256(runtime), row.sha256, `${row.path} runtime hash`);
		assert.equal(sha256(selectedOriginal), row.sha256, `${row.path} selected-original hash`);
		assert.deepEqual(runtime, selectedOriginal, `${row.path} is a byte-preserved import`);
		assert.equal(row.sha256, sourceVariant.sha256, `${row.path} source-manifest hash`);
		assert.equal(row.codec, sourceVariant.codec, `${row.path} codec`);
		assert.equal(row.sampleRateHz, sourceVariant.sampleRateHz, `${row.path} sample rate`);
		assert.equal(row.channels, sourceVariant.channels, `${row.path} channel count`);
		assert.equal(row.durationMs, sourceVariant.durationMs, `${row.path} duration`);
	}
	assert.equal(runtimeBytes, runtimeManifest.budgets.runtimeBytes);
	assert.deepEqual([...runtimeFileByPath.keys()].sort(), [...BLACKSITE_AUDIO_RUNTIMEPACK_FILES].sort());

	const criticalFiles = new Set(runtimeManifest.cues
		.filter((cue) => cue.bank === 'critical')
		.flatMap((cue) => cue.runtimeFiles));
	const criticalBytes = [...criticalFiles].reduce((sum, path) => sum + runtimeFileByPath.get(path).bytes, 0);
	assert.equal(criticalBytes, runtimeManifest.budgets.criticalRuntimeBytes);
	assert.ok(criticalBytes <= 1_500 * 1024);
	assert.ok(runtimeBytes <= 8 * 1024 * 1024);
	assert.equal(runtimeManifest.files.some((row) => /human_(?:01|03)/iu.test(row.path)), false, 'human-like Penguin alternates stay excluded');
	assert.equal(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG['music.blackout'].sourceEvent, 'music.freespins');
	assert.match(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG['music.blackout'].files[0], /bsb_music_freespins_v02\.opus$/u);
	assert.deepEqual(
		['feature.expand.attack', 'feature.expand.reel', 'feature.expand.settle'].map((cueId) => BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId].sourceEvent),
		['wild.activate', 'symbol.drop', 'symbol.lock'],
	);
});

test('provenance retains the supplied CC0 evidence and explicitly leaves legal and audible QA caveats open', async () => {
	assert.equal(selection.sourceArchive.sha256, '00bd81eb277623763b5b3626617c3eca0e035b46f0547a8d772b4c63582aad1a');
	assert.equal(importReport.sourceArchive.sha256, selection.sourceArchive.sha256);
	assert.equal(runtimeManifest.sourceArchive.sha256, selection.sourceArchive.sha256);
	assert.equal(importReport.sourceArchive.manifestSha256, sha256(await readFile(new URL('art/audio/runtimepack-v1/source-audio-manifest.json', appRoot))));
	assert.equal(runtimeManifest.sourceArchive.manifestSha256, importReport.sourceArchive.manifestSha256);
	assert.equal(sourceManifest.licensePolicy, 'CC0-only; see 03_LICENSES_AND_PROVENANCE');
	assert.match(licenseSummary, /not a warranty or legal opinion/iu);
	assert.match(licenseSummary, /re-check licenses/iu);
	assert.match(licenseSummary, /source-page marker is evidence gathered during curation/iu);
	assert.match(legalCode, /Creative Commons Corporation/iu);
	assert.match(excludedSources, /Mixkit/iu);
	assert.match(excludedSources, /Pixabay/iu);
	for (const row of sourcesCsv.trim().split(/\r?\n/u).slice(1)) {
		assert.match(row, /,CC0 1\.0 Universal \/ Public Domain Dedication,/u);
		assert.match(row, /,YES,/u);
	}
	for (const row of curatedAssetMapCsv.trim().split(/\r?\n/u).slice(1)) {
		assert.match(row, /,02_SOURCE_LIBRARY_CC0\//u);
	}
	assert.equal(importReport.audibleQa, 'PENDING_USER_AND_DEVICE_AUDITION');
});

test('variant selection is deterministic from identity, event index, cue and ordinal', () => {
	const options = { roundOrReplayId: 'round-42', eventIndex: 7, ordinal: 3 };
	const first = deterministicAudioVariant('reel.stop.4', 4, options);
	assert.equal(first, deterministicAudioVariant('reel.stop.4', 4, { ...options }));
	assert.equal(first, deterministicAudioVariant('reel.stop.4', 4, { replayId: 'round-42', eventIndex: 7, ordinal: 3 }));
	assert.equal(blacksiteAudioEventKey({ ...options, cueId: 'reel.stop.4' }), 'round-42|7|reel.stop.4|3');
	assert.equal(blacksiteAudioEventKey({ cueId: 'reel.stop.4' }), null);
	assert.doesNotMatch(directorSource, /Math\.random|crypto\.getRandomValues/gu);
});

test('critical predecode is explicit and Vault/BLACKOUT/extended feature banks stay lazy', async () => {
	const requested = new Set();
	const director = makeDirector({ assetLoader: async (path) => { requested.add(path); return fakeBuffer; } });
	const critical = await director.preloadCritical();
	assert.equal(critical.failed, 0);
	assert.equal(critical.loaded, critical.requested);
	assert.equal(critical.requested, new Set(BLACKSITE_AUDIO_RUNTIMEPACK_BANKS.critical
		.flatMap((cueId) => BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId].files)).size);
	assert.equal([...requested].some((path) => path.includes('/vault-')), false);
	await director.preloadVault();
	for (const cueId of [
		...BLACKSITE_AUDIO_RUNTIMEPACK_BANKS.vault,
		...BLACKSITE_AUDIO_RUNTIMEPACK_BANKS.blackout,
		...BLACKSITE_AUDIO_RUNTIMEPACK_BANKS.extended,
	]) {
		for (const path of BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId].files) assert.ok(requested.has(path), `lazy-load ${path}`);
	}
	assert.equal(FakeAudioContext.instances.at(-1).gains.length, 7, 'master plus six bus gain nodes');
	director.destroy();
});

test('mute preserves the bounded win rollup and requested BLACKOUT techno bed', async () => {
	FakeAudioContext.instances.length = 0;
	const director = makeDirector();
	await director.preloadCritical();
	await director.unlock();
	const context = FakeAudioContext.instances.at(-1);
	assert.equal(director.play('win.rollup.loop', { dedupe: false }), true);
	await tick();
	assert.equal(director.snapshot().voices.Wins, 1);
	const sourcesBeforeMute = context.sources.length;
	assert.equal(director.muteWithCue('ui.toggle.off').muted, true);
	assert.equal(context.sources.length, sourcesBeforeMute + 1, 'predecoded mute latch starts synchronously');
	assert.ok(context.sources.at(-1).stopTime != null, 'mute latch and all owned voices receive the 20 ms mute ramp');
	assert.equal(director.setScene('blackout'), true);
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.equal(director.setMuted(false).muted, false);
	await tick();
	await tick();
	assert.equal(director.snapshot().voices.Wins, 1, 'short-lived rollup loop resumes until the counter stops it');
	assert.equal(director.snapshot().voices.Music, 1, 'BLACKOUT music resumes with its requested scene');
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.equal(director.snapshot().scene, 'blackout');
	director.stop('win.rollup.loop');
	director.setScene('base');
	director.destroy();
});

test('replay and restore one-shots dedupe by canonical presentation identity', async () => {
	const director = makeDirector();
	const event = { roundOrReplayId: 'replay-abc', eventIndex: 19, ordinal: 0 };
	assert.equal(director.play('win.big', event), true);
	assert.equal(director.play('win.big', event), false);
	director.primeConsumed([{ roundOrReplayId: 'restore-def', eventIndex: 4, cueId: 'breach.trigger', ordinal: 0 }]);
	assert.equal(director.play('breach.trigger', { roundOrReplayId: 'restore-def', eventIndex: 4, ordinal: 0 }), false);
	assert.equal(director.play('breach.trigger', { roundOrReplayId: 'new-round', eventIndex: 4, ordinal: 0 }), true);
	await tick();
	assert.equal(director.snapshot().voices.Wins, 1);
	assert.equal(director.snapshot().voices.Reels, 1);
	director.destroy();
});

test('bus polyphony is bounded and higher priority steals a lower noncritical voice', async () => {
	const director = makeDirector();
	for (let ordinal = 0; ordinal < 10; ordinal += 1) director.play('symbol.land.regular', { ordinal, dedupe: false });
	await tick();
	assert.equal(director.snapshot().voices.Reels, 10);
	const context = FakeAudioContext.instances.at(-1);
	assert.equal(director.play('breach.trigger', { roundOrReplayId: 'round-priority', eventIndex: 8 }), true);
	await tick();
	assert.equal(director.snapshot().voices.Reels, 10);
	assert.ok(context.sources.some((source) => source.stopTime != null), 'one low-priority voice was stolen');
	for (let ordinal = 0; ordinal < 12; ordinal += 1) director.play('ui.hover', { ordinal, dedupe: false });
	await tick();
	assert.equal(director.snapshot().voices.UI, 4);
	director.destroy();
});

test('BLACKOUT keeps its techno bed while retiring stale machine loops and base stays quiet', async () => {
	FakeAudioContext.instances.length = 0;
	const documentRef = new FakeDocument();
	const values = new Map();
	const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
	const director = makeDirector({ documentRef, storage });
	for (const cueId of ['reels.motor.loop', 'anticipation.confirmed', 'ambience.tension']) {
		assert.equal(director.play(cueId, { dedupe: false }), true, `simulate stale ${cueId}`);
	}
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.snapshot().voices.Reels, 2);
	assert.equal(director.snapshot().voices.Ambience, 1);
	assert.equal(director.setScene('blackout'), true);
	await tick();
	assert.equal(director.snapshot().voices.Music, 1, 'BLACKOUT transition starts exactly one techno bed');
	assert.equal(director.snapshot().voices.Reels, 0, 'BLACKOUT transition clears the stale machine loop');
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.equal(director.setScene('base'), true);
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.equal(director.play('ui.press', { dedupe: false }), true, 'event SFX remain available in quiet base idle');
	await tick();
	assert.equal(director.snapshot().voices.UI, 1);
	documentRef.setVisibility('hidden');
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.ok(FakeAudioContext.instances[0].suspendCalls >= 1);
	documentRef.setVisibility('visible');
	await tick();
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.snapshot().voices.Ambience, 0);
	assert.equal(director.setMuted(true).muted, true);
	assert.equal(values.get('blacksite_breach:audio-muted:v1'), '1');
	assert.equal(director.snapshot().voices.Music, 0);
	assert.equal(director.setMuted(false).muted, false);
	await tick();
	assert.equal(director.snapshot().voices.Music, 0);
	const context = FakeAudioContext.instances[0];
	director.destroy();
	await tick();
	assert.equal(documentRef.listeners.size, 0);
	assert.equal(context.closed, true);
	assert.equal(director.activeNodes.size, 0);
});

test('director source has no payout, wallet, RGS or result-randomness authority', () => {
	assert.doesNotMatch(
		directorSource,
		/Math\.random|crypto\.getRandomValues|live-session|rgs-client|authenticate|end-round|wallet|payout|freeSpins|\/play\b/iu,
	);
});
