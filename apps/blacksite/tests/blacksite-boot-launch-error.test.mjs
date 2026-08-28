import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

test('critical startup failures replace the boot presentation while gameplay remains inert', () => {
	assert.match(
		pageSource,
		/\$: bootInteractionLocked = bootSequenceState !== BOOT_SEQUENCE_STATE\.GAME_READY;[\s\S]*?\$: startupFailureVisible = bootInteractionLocked\s*&& Boolean\(runtimeError \|\| launch\.kind === 'error'\);/u,
	);
	assert.match(
		pageSource,
		/<main[\s\S]*?inert=\{bootInteractionLocked\}[\s\S]*?aria-hidden=\{bootInteractionLocked \? 'true' : undefined\}/u,
	);

	const mainClose = pageSource.indexOf('</main>');
	const failureGateStart = pageSource.indexOf('{#if startupFailureVisible}', mainClose);
	const bootElse = pageSource.indexOf('{:else}', failureGateStart);
	const bootSequence = pageSource.indexOf('<BlacksiteBootSequence', bootElse);
	const gateEnd = pageSource.indexOf('{/if}', bootSequence);

	assert.ok(mainClose >= 0, 'the inert gameplay root exists');
	assert.ok(failureGateStart > mainClose, 'the startup failure gate is outside the inert gameplay root');
	assert.ok(bootElse > failureGateStart, 'the ordinary boot presentation is the failure gate alternate');
	assert.ok(bootSequence > bootElse && gateEnd > bootSequence, 'the boot presentation remains in the normal branch');

	const failureMarkup = pageSource.slice(failureGateStart, bootElse);
	assert.match(failureMarkup, /data-testid="startup-failure-gate"/u);
	assert.match(failureMarkup, /data-testid="launch-error"[\s\S]*?role="alertdialog"[\s\S]*?aria-modal="true"/u);
	assert.match(failureMarkup, /data-testid="recovery-action"[\s\S]*?on:click=\{recoverRuntime\}/u);
	assert.match(failureMarkup, /Gameplay remains locked\./u);
	assert.doesNotMatch(failureMarkup, /GAME_READY|handleBootReady|missionaccepted|\/wallet\/play/u);
});

test('startup failure routing preserves the established ready callbacks and reload-only recovery', () => {
	assert.match(
		pageSource,
		/\{#if \(runtimeError \|\| launch\.kind === 'error'\) && !devUiV21Enabled && !startupFailureVisible\}/u,
	);
	assert.match(
		pageSource,
		/\{#if devUiV21Enabled && \(runtimeError \|\| launch\.kind === 'error'\) && !startupFailureVisible\}/u,
	);
	assert.match(
		pageSource,
		/<BlacksiteBootSequence[\s\S]*?on:statechange=\{handleBootStateChange\}[\s\S]*?on:missionaccepted=\{handleBootMissionAccepted\}[\s\S]*?on:ready=\{handleBootReady\}[\s\S]*?\/>/u,
	);

	const recoveryStart = pageSource.indexOf('function recoverRuntime()');
	const recoveryEnd = pageSource.indexOf('\n\tfunction fixtureFailure', recoveryStart);
	const recoverySource = pageSource.slice(recoveryStart, recoveryEnd);
	assert.match(recoverySource, /^function recoverRuntime\(\) \{\s*window\.location\.reload\(\);\s*\}\s*$/u);
	assert.doesNotMatch(recoverySource, /bootSequenceState|GAME_READY|liveSession|play\(|wallet|fetch/u);

	assert.match(
		pageSource,
		/\(devUiV21Enabled \|\| startupFailureVisible\)[\s\S]*?void tick\(\)\.then\(\(\) => recoveryButton\?\.focus\?\.\(\)\);/u,
	);
});
