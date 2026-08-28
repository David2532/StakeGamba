import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveLaunchMode } from '../src/lib/runtime/launch-mode.js';
import {
	DEV_VAULT_RIG_HOOKS,
	VAULT_RENDERER,
	createVaultSurfaceHooks,
	selectVaultRenderer,
} from './helpers/dev-vault-rig-contract.mjs';

const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const cinematicSource = await readFile(
	new URL('../src/lib/components/VaultCinematic.svelte', import.meta.url),
	'utf8',
);
const viteSource = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const contractSource = await readFile(
	new URL('./helpers/dev-vault-rig-contract.mjs', import.meta.url),
	'utf8',
);

const LIVE_SEARCH =
	'?sessionID=dev-contract&rgs_url=https%3A%2F%2Frgs.example&currency=USD&lang=en&device=desktop';
const REPLAY_SEARCH =
	'?replay=true&game=blacksite_breach&version=0.3.0-math-v3&mode=base&event=1' +
	'&rgs_url=https%3A%2F%2Frgs.example&currency=USD&amount=1';

test('DEV 2.5D Vault rig requires compile-time DEV plus one validated fixture', () => {
	const fixtureLaunch = resolveLaunchMode('?dev_fixture=base_natural_blackout', { dev: true });
	const activeFixture = Object.freeze({ id: 'base_natural_blackout' });

	assert.deepEqual(
		selectVaultRenderer({ devFixturesEnabled: true, launch: fixtureLaunch, activeFixture }),
		{
			renderer: VAULT_RENDERER.DEV_2D5_RIG,
			useDevRig: true,
			useProductionCinematic: false,
			fixtureId: 'base_natural_blackout',
		},
	);

	for (const candidate of [
		{ devFixturesEnabled: false, launch: fixtureLaunch, activeFixture },
		{ devFixturesEnabled: true, launch: fixtureLaunch, activeFixture: null },
		{ devFixturesEnabled: true, launch: fixtureLaunch, activeFixture: { id: 'base_zero' } },
		{ devFixturesEnabled: true, launch: resolveLaunchMode(LIVE_SEARCH), activeFixture },
		{ devFixturesEnabled: true, launch: resolveLaunchMode(REPLAY_SEARCH), activeFixture },
		{ devFixturesEnabled: true, launch: { kind: 'error' }, activeFixture },
	]) {
		assert.deepEqual(selectVaultRenderer(candidate), {
			renderer: VAULT_RENDERER.PRODUCTION_RASTER,
			useDevRig: false,
			useProductionCinematic: true,
			fixtureId: null,
		});
	}

	assert.equal(
		resolveLaunchMode('?dev_fixture=base_natural_blackout', { dev: false }).code,
		'DEV_FIXTURE_FORBIDDEN',
	);
});

test('renderer-independent hooks retain cinematic semantics and mark DEV explicitly', () => {
	const production = selectVaultRenderer();
	assert.deepEqual(createVaultSurfaceHooks(production, {
		state: 'door-opening',
		phase: 'opening',
		generation: 8,
	}), {
		root: {
			'data-testid': 'vault-cinematic',
			'data-vault-renderer': 'raster-film',
			'data-vault-state': 'door-opening',
			'data-vault-phase': 'opening',
		},
		surface: {
			'data-testid': 'vault-opening-animation',
			'data-vault-generation': '8',
		},
	});

	const dev = selectVaultRenderer({
		devFixturesEnabled: true,
		launch: { kind: 'fixture', fixtureId: 'base_natural_blackout' },
		activeFixture: { id: 'base_natural_blackout' },
	});
	assert.deepEqual(createVaultSurfaceHooks(dev, {
		state: 'light-entry',
		phase: 'opening',
		generation: 9,
	}), {
		root: {
			'data-testid': 'vault-cinematic',
			'data-vault-renderer': 'dev-2d5-rig',
			'data-vault-state': 'light-entry',
			'data-vault-phase': 'opening',
			'data-dev-fixture': 'base_natural_blackout',
		},
		surface: {
			'data-testid': 'vault-dev-2d5-rig',
			'data-vault-generation': '9',
			'data-dev-only': 'true',
		},
	});

	assert.deepEqual(DEV_VAULT_RIG_HOOKS, {
		rootTestId: 'vault-cinematic',
		productionSurfaceTestId: 'vault-opening-animation',
		devSurfaceTestId: 'vault-dev-2d5-rig',
		rendererAttribute: 'data-vault-renderer',
		stateAttribute: 'data-vault-state',
		phaseAttribute: 'data-vault-phase',
		generationAttribute: 'data-vault-generation',
		fixtureAttribute: 'data-dev-fixture',
		devOnlyAttribute: 'data-dev-only',
	});
});

test('production keeps a timer-owned video cinematic with a static poster fallback surface', () => {
	assert.match(
		viteSource,
		/__BLACKSITE_DEV_FIXTURES__:\s*JSON\.stringify\(command === 'serve'\)/u,
	);
	assert.match(
		pageSource,
		/resolveLaunchMode\(window\.location\.search, \{ dev: __BLACKSITE_DEV_FIXTURES__ \}\)/u,
	);
	assert.match(pageSource, /<VaultCinematic[\s\S]*cinematic=\{vaultCinematicState\}/u);
	assert.match(cinematicSource, /data-testid="vault-cinematic"/u);
	assert.match(cinematicSource, /data-vault-state=\{state\}/u);
	assert.match(cinematicSource, /data-vault-phase=\{cinematic\?\.phase \?\? 'idle'\}/u);
	assert.match(cinematicSource, /data-testid="vault-opening-animation"/u);
	assert.match(cinematicSource, /src=\{openingVideoSrc\}/u);
	assert.match(
		cinematicSource,
		/\{:else if \(!openingMediaCommitted \|\| openingMediaTier === VAULT_MEDIA_TIER\.POSTER\) && openingPosterSrc\}[\s\S]*'static-poster-pending'[\s\S]*'static-poster'[\s\S]*'static-poster-fallback'[\s\S]*src=\{openingPosterSrc\}/u,
	);
	assert.doesNotMatch(
		pageSource,
		/<button\b[^>]*(?:dev_fixture|vault-dev-2d5-rig|2\.5d)[^>]*>/iu,
		'no player-facing production test button may select the DEV renderer',
	);
});

test('DEV renderer policy is presentation-only and does not parse a second query flag', () => {
	assert.doesNotMatch(
		contractSource,
		/URLSearchParams|window\.location|Math\.random|crypto\.getRandomValues|\bfetch\s*\(|wallet|authenticate|rgs|payout|settlement/iu,
	);
	assert.match(contractSource, /launch\?\.kind === 'fixture'/u);
	assert.match(contractSource, /launchFixtureId === activeFixtureId/u);
	assert.match(contractSource, /devFixturesEnabled === true/u);
});
