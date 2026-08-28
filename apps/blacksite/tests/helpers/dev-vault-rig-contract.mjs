export const VAULT_RENDERER = Object.freeze({
	PRODUCTION_RASTER: 'raster-film',
	DEV_2D5_RIG: 'dev-2d5-rig',
});

export const DEV_VAULT_RIG_HOOKS = Object.freeze({
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

function validFixtureId(value) {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Contract for a future DEV-only 2.5D Vault surface.
 *
 * A raw query string is deliberately not accepted here. The caller must pass
 * the result of resolveLaunchMode and the catalog fixture that was actually
 * loaded. This keeps the renderer experiment behind both the compile-time DEV
 * gate and the existing fail-closed fixture catalog boundary.
 */
export function selectVaultRenderer({
	devFixturesEnabled = false,
	launch = null,
	activeFixture = null,
} = {}) {
	const launchFixtureId = launch?.kind === 'fixture' ? launch.fixtureId : null;
	const activeFixtureId = activeFixture?.id;
	const useDevRig = devFixturesEnabled === true
		&& validFixtureId(launchFixtureId)
		&& validFixtureId(activeFixtureId)
		&& launchFixtureId === activeFixtureId;

	return Object.freeze({
		renderer: useDevRig ? VAULT_RENDERER.DEV_2D5_RIG : VAULT_RENDERER.PRODUCTION_RASTER,
		useDevRig,
		useProductionCinematic: !useDevRig,
		fixtureId: useDevRig ? activeFixtureId : null,
	});
}

function normalizedGeneration(value) {
	return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function normalizedSemanticValue(value, fallback) {
	return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Stable browser hooks shared by the current raster film and a future DEV rig.
 * The DEV surface must preserve the outer semantic hooks so existing cinematic
 * state/award assertions remain renderer-independent.
 */
export function createVaultSurfaceHooks(selection, cinematic = null) {
	if (
		selection?.renderer !== VAULT_RENDERER.PRODUCTION_RASTER
		&& selection?.renderer !== VAULT_RENDERER.DEV_2D5_RIG
	) {
		throw new TypeError('A valid Vault renderer selection is required.');
	}

	const root = {
		'data-testid': DEV_VAULT_RIG_HOOKS.rootTestId,
		[DEV_VAULT_RIG_HOOKS.rendererAttribute]: selection.renderer,
		[DEV_VAULT_RIG_HOOKS.stateAttribute]: normalizedSemanticValue(cinematic?.state, 'idle'),
		[DEV_VAULT_RIG_HOOKS.phaseAttribute]: normalizedSemanticValue(cinematic?.phase, 'idle'),
	};
	const surface = {
		'data-testid': selection.useDevRig
			? DEV_VAULT_RIG_HOOKS.devSurfaceTestId
			: DEV_VAULT_RIG_HOOKS.productionSurfaceTestId,
		[DEV_VAULT_RIG_HOOKS.generationAttribute]: String(normalizedGeneration(cinematic?.generation)),
	};

	if (selection.useDevRig) {
		root[DEV_VAULT_RIG_HOOKS.fixtureAttribute] = selection.fixtureId;
		surface[DEV_VAULT_RIG_HOOKS.devOnlyAttribute] = 'true';
	}

	return Object.freeze({
		root: Object.freeze(root),
		surface: Object.freeze(surface),
	});
}
