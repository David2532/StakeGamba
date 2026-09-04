import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	BLACKSITE_PERFORMANCE_BUDGET,
	BLACKSITE_PERFORMANCE_METRIC_KEYS,
	median,
	summarizePerformanceRuns,
} from '../../../scripts/blacksite-performance-budget.mjs';

const browserQaUrl = new URL('../../../scripts/blacksite-qa-e2e.mjs', import.meta.url);
const performanceLabUrl = new URL(
	'../../../scripts/blacksite-performance-lab.mjs',
	import.meta.url,
);
const documentationUrl = new URL('../../../docs/blacksite/PERFORMANCE_BUDGETS.md', import.meta.url);

test('performance budgets are predeclared for three comparable live, intro and Replay runs', () => {
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.schema, 'blacksite-performance-budget-v1');
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.definedAt, '2026-09-03');
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.measurementKind, 'controlled-local-lab');
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.fieldData, false);
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState, 3);
	assert.deepEqual(Object.keys(BLACKSITE_PERFORMANCE_BUDGET.states), [
		'live-first-play',
		'intro-full',
		'replay-complete',
	]);
	for (const state of Object.values(BLACKSITE_PERFORMANCE_BUDGET.states)) {
		assert.deepEqual(Object.keys(state.ceilings), BLACKSITE_PERFORMANCE_METRIC_KEYS);
		assert.equal(state.ceilings.lcpMs, 2_500);
		assert.equal(state.ceilings.scriptedInteractionLatencyMs, 200);
		assert.equal(state.ceilings.cls, 0.1);
	}
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.coreWebVitalsReference.thresholds.lcpMs, 2_500);
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.coreWebVitalsReference.thresholds.inpMs, 200);
	assert.equal(BLACKSITE_PERFORMANCE_BUDGET.coreWebVitalsReference.thresholds.cls, 0.1);
	assert.match(
		BLACKSITE_PERFORMANCE_BUDGET.coreWebVitalsReference.labCaveat,
		/not CrUX\/RUM field data/u,
	);
});

test('three-run reporting exposes a median without pretending to be field p75', () => {
	assert.equal(median([19, 11, 13]), 13);
	assert.equal(median([1, 3, 5, 7]), 4);
	assert.throws(() => median([]), /at least one/u);
});

test('performance summaries fail closed for insufficient runs and over-budget metrics', () => {
	const passingRun = (run) => ({
		stateId: 'live-first-play',
		run,
		readyMs: 100,
		completeMs: 120,
		lcpMs: 90,
		scriptedInteractionLatencyMs: 16,
		cls: 0,
		lifecycleLongTaskBlockingMs: 0,
		frameIntervalP95Ms: 17,
		frameIntervalMaxMs: 20,
		frameIntervalsOver50Count: 0,
		decodedBodyBytes: 400_000,
		navigation: {
			responseEndMs: 20,
			domInteractiveMs: 60,
			domContentLoadedMs: 70,
			loadEventEndMs: 80,
		},
	});
	assert.throws(
		() => summarizePerformanceRuns('live-first-play', [passingRun(1), passingRun(2)]),
		/at least 3 runs/u,
	);
	const passing = summarizePerformanceRuns('live-first-play', [
		passingRun(1),
		passingRun(2),
		passingRun(3),
	]);
	assert.equal(passing.status, 'PASS');
	assert.equal(passing.metrics.readyMs.median, 100);
	assert.equal(passing.metrics.readyMs.range, 0);

	const slowRun = { ...passingRun(3), lcpMs: 2_501 };
	const failing = summarizePerformanceRuns('live-first-play', [
		passingRun(1),
		passingRun(2),
		slowRun,
	]);
	assert.equal(failing.status, 'FAIL');
	assert.deepEqual(failing.failures, [
		{
			metric: 'lcpMs',
			observedMax: 2_501,
			ceiling: 2_500,
			overBudgetRuns: [{ run: 3, observation: 2_501 }],
		},
	]);

	assert.throws(
		() =>
			summarizePerformanceRuns('live-first-play', [
				passingRun(1),
				passingRun(2),
				{ ...passingRun(3), readyMs: 0 },
			]),
		/invalid readyMs observation/u,
	);
	assert.throws(
		() =>
			summarizePerformanceRuns('live-first-play', [
				passingRun(1),
				passingRun(2),
				{ ...passingRun(3), completeMs: 99 },
			]),
		/completes before its ready barrier/u,
	);
	assert.throws(
		() =>
			summarizePerformanceRuns('live-first-play', [
				passingRun(1),
				passingRun(2),
				{ ...passingRun(3), navigation: null },
			]),
		/invalid navigation entry/u,
	);
	assert.throws(
		() =>
			summarizePerformanceRuns('live-first-play', [passingRun(1), passingRun(3), passingRun(2)]),
		/consecutive one-based IDs/u,
	);
});

test('exact Chromium harness and documentation retain the lab-versus-field boundary', async () => {
	const [browserQa, performanceLab, documentation] = await Promise.all([
		readFile(browserQaUrl, 'utf8'),
		readFile(performanceLabUrl, 'utf8'),
		readFile(documentationUrl, 'utf8'),
	]);
	assert.match(browserQa, /runPerformanceLabScenarios\(browser, staticServer\.origin\)/u);
	assert.match(browserQa, /performance-lab-\$\{stateId\}-three-cold-runs/u);
	assert.match(performanceLab, /PerformanceObserver\?\.supportedEntryTypes/u);
	assert.match(performanceLab, /armPerformancePrimaryInteraction/u);
	assert.match(performanceLab, /trustedClickCount !== 1/u);
	assert.match(performanceLab, /fieldDataStatus: 'NOT_COLLECTED'/u);
	assert.match(browserQa, /minimumRunsPerState/u);
	assert.match(documentation, /controlled lab diagnostics/u);
	assert.match(documentation, /not Chrome UX Report data, production RUM/u);
	assert.match(documentation, /real Android\/iOS hardware/u);
});
