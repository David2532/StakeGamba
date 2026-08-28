import { BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA } from './blacksite-audio-runtimepack-v1.generated.js';

const BUS_SPECS = Object.freeze({
	Music: Object.freeze({ gainDb: -12, maxVoices: 2, steal: 'oldest-loop-first' }),
	Ambience: Object.freeze({ gainDb: -14, maxVoices: 3, steal: 'lowest-priority-oldest' }),
	Reels: Object.freeze({ gainDb: -6, maxVoices: 10, steal: 'lowest-priority-oldest', reservedCritical: 2 }),
	Wins: Object.freeze({ gainDb: -5, maxVoices: 5, steal: 'lowest-tier-first' }),
	UI: Object.freeze({ gainDb: -10, maxVoices: 4, steal: 'repeated-lowest-priority-first' }),
	Voice: Object.freeze({ gainDb: -9, maxVoices: 2, steal: 'oldest-noncritical' }),
});

function createCatalog() {
	return Object.freeze(Object.fromEntries(BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.cues.map((cue) => [
		cue.cueId,
		Object.freeze({
			cueId: cue.cueId,
			sourceEvent: cue.sourceEvent,
			bus: cue.bus,
			bank: cue.bank,
			priority: cue.priority,
			pan: cue.pan,
			loop: cue.loop,
			protected: cue.protected,
			duck: cue.duck,
			files: Object.freeze([...cue.runtimeFiles]),
		}),
	])));
}

export const BLACKSITE_AUDIO_RUNTIMEPACK_BUSES = BUS_SPECS;
export const BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG = createCatalog();
export const BLACKSITE_AUDIO_RUNTIMEPACK_CUES = Object.freeze(
	Object.keys(BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG),
);
export const BLACKSITE_AUDIO_RUNTIMEPACK_FILES = Object.freeze([
	...new Set(BLACKSITE_AUDIO_RUNTIMEPACK_CUES.flatMap(
		(cueId) => BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId].files,
	)),
]);
export const BLACKSITE_AUDIO_RUNTIMEPACK_BANKS = Object.freeze(Object.fromEntries(
	['critical', 'base', 'vault', 'blackout', 'extended'].map((bank) => [bank, Object.freeze(
		BLACKSITE_AUDIO_RUNTIMEPACK_CUES.filter(
			(cueId) => BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG[cueId].bank === bank,
		),
	)]),
));
export const BLACKSITE_AUDIO_RUNTIMEPACK_RUNTIME_MANIFEST =
	`${BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot}/audio-manifest.json`;

export function blacksiteAudioRuntimePackAsset(relativePath, href = globalThis.window?.location?.href) {
	const runtimeRoot = BLACKSITE_AUDIO_RUNTIMEPACK_V1_DATA.runtimeRoot;
	const path = relativePath.startsWith(`${runtimeRoot}/`)
		? relativePath
		: `${runtimeRoot}/${relativePath}`;
	if (!href) return path;
	const packageBase = new URL(href);
	packageBase.search = '';
	packageBase.hash = '';
	if (!packageBase.pathname.endsWith('/')) {
		const lastSegment = packageBase.pathname.split('/').at(-1) ?? '';
		packageBase.pathname = /\.html?$/iu.test(lastSegment)
			? packageBase.pathname.slice(0, -lastSegment.length)
			: `${packageBase.pathname}/`;
	}
	return new URL(path, packageBase).href;
}

// Compatibility aliases keep the established director and downstream imports stable while the
// delivery advances from the generated V28 WAV slice to the curated RuntimePack V1/V29.
export const BLACKSITE_AUDIO_V28_BUSES = BLACKSITE_AUDIO_RUNTIMEPACK_BUSES;
export const BLACKSITE_AUDIO_V28_CATALOG = BLACKSITE_AUDIO_RUNTIMEPACK_CATALOG;
export const BLACKSITE_AUDIO_V28_CUES = BLACKSITE_AUDIO_RUNTIMEPACK_CUES;
export const BLACKSITE_AUDIO_V28_FILES = BLACKSITE_AUDIO_RUNTIMEPACK_FILES;
export const BLACKSITE_AUDIO_V28_BANKS = BLACKSITE_AUDIO_RUNTIMEPACK_BANKS;
export const BLACKSITE_AUDIO_V28_RUNTIME_MANIFEST = BLACKSITE_AUDIO_RUNTIMEPACK_RUNTIME_MANIFEST;
export const blacksiteAudioV28Asset = blacksiteAudioRuntimePackAsset;
