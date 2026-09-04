const METRIC_KEYS = Object.freeze([
	'readyMs',
	'completeMs',
	'lcpMs',
	'scriptedInteractionLatencyMs',
	'cls',
	'lifecycleLongTaskBlockingMs',
	'frameIntervalP95Ms',
	'frameIntervalMaxMs',
	'frameIntervalsOver50Count',
	'decodedBodyBytes',
]);

const POSITIVE_METRIC_KEYS = new Set([
	'readyMs',
	'completeMs',
	'lcpMs',
	'scriptedInteractionLatencyMs',
	'frameIntervalP95Ms',
	'frameIntervalMaxMs',
	'decodedBodyBytes',
]);

function deepFreeze(value) {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

/**
 * Source-controlled before the corresponding measurements are captured. A QA run reads these
 * limits but never derives or rewrites them from observed results.
 */
export const BLACKSITE_PERFORMANCE_BUDGET = deepFreeze({
	schema: 'blacksite-performance-budget-v1',
	definedAt: '2026-09-03',
	measurementKind: 'controlled-local-lab',
	fieldData: false,
	minimumRunsPerState: 3,
	aggregation: {
		method: 'all-runs-under-ceiling',
		reporting: ['observations', 'min', 'median', 'max', 'range'],
		note: 'Three local observations are not a field percentile. Every run must meet its ceiling; median and range expose variability.',
	},
	comparisonProfile: {
		viewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
		cache:
			'A new isolated browser context for every run with no-store responses; HTTP-cache-cold, not a cold browser process or machine.',
		network: 'Loopback static build and deterministic mocked RGS; no network or CPU throttling.',
		motion: 'Normal motion and a foreground tab.',
		sequence:
			'Performance states run first, sequentially, in the newly launched exact-QA Chromium process.',
	},
	coreWebVitalsReference: {
		source: 'https://web.dev/articles/vitals',
		retrievedAt: '2026-09-03',
		assessment:
			'Good field thresholds at the 75th percentile, assessed separately for mobile and desktop.',
		thresholds: { lcpMs: 2_500, inpMs: 200, cls: 0.1 },
		labCaveat:
			'Playwright PerformanceObserver values are controlled lab diagnostics, not CrUX/RUM field data.',
	},
	metricDefinitions: {
		readyMs:
			'Conservative navigation-to-ready upper bound sampled after the state, network and asset-paint barriers resolve.',
		completeMs:
			'Conservative navigation-to-terminal upper bound sampled after the route-specific terminal barrier resolves.',
		lcpMs: 'Largest Contentful Paint from Chromium PerformanceObserver.',
		scriptedInteractionLatencyMs:
			'Chromium Event Timing duration for one trusted scripted primary Play/Replay interaction; an INP-oriented lab guard, not page-lifecycle INP.',
		cls: 'Largest Chromium layout-shift session window (less than 1s between shifts, capped at 5s), excluding recent input.',
		lifecycleLongTaskBlockingMs:
			'Lab diagnostic over the measured lifecycle: sum of long-task duration above 50ms; explicitly not Lighthouse TBT.',
		frameIntervalP95Ms:
			'Nearest-rank p95 requestAnimationFrame interval over the measured lifecycle.',
		frameIntervalMaxMs: 'Worst requestAnimationFrame interval over the measured lifecycle.',
		frameIntervalsOver50Count: 'Count of measured requestAnimationFrame intervals above 50ms.',
		decodedBodyBytes:
			'Navigation plus same-origin resource decoded body bytes reported by Chromium.',
	},
	states: {
		'live-first-play': {
			description:
				'Returning live player, intro already seen, through one authoritative zero-result play.',
			terminalState: 'live-ready after the first legal play completes',
			interaction: 'Primary Play action backed by the deterministic zero-result RGS fixture.',
			ceilings: {
				readyMs: 1_500,
				completeMs: 3_000,
				lcpMs: 2_500,
				scriptedInteractionLatencyMs: 200,
				cls: 0.1,
				lifecycleLongTaskBlockingMs: 200,
				frameIntervalP95Ms: 50,
				frameIntervalMaxMs: 250,
				frameIntervalsOver50Count: 2,
				decodedBodyBytes: 1_000_000,
			},
		},
		'intro-full': {
			description: 'Fresh live player through the complete authored normal boot intro.',
			terminalState: 'live-ready after the intro and first legal play complete',
			interaction:
				'Primary Play action after intro completion, backed by the deterministic zero-result RGS fixture.',
			ceilings: {
				readyMs: 4_500,
				completeMs: 6_000,
				lcpMs: 2_500,
				scriptedInteractionLatencyMs: 200,
				cls: 0.1,
				lifecycleLongTaskBlockingMs: 200,
				frameIntervalP95Ms: 50,
				frameIntervalMaxMs: 250,
				frameIntervalsOver50Count: 12,
				decodedBodyBytes: 1_000_000,
			},
		},
		'replay-complete': {
			description: 'Read-only Replay route from cold navigation through deterministic completion.',
			terminalState: 'replay-completed',
			interaction: 'Primary Replay action; no wallet or event writes.',
			ceilings: {
				readyMs: 1_500,
				completeMs: 3_000,
				lcpMs: 2_500,
				scriptedInteractionLatencyMs: 200,
				cls: 0.1,
				lifecycleLongTaskBlockingMs: 200,
				frameIntervalP95Ms: 50,
				frameIntervalMaxMs: 250,
				frameIntervalsOver50Count: 4,
				decodedBodyBytes: 1_000_000,
			},
		},
	},
});

export function median(values) {
	if (!Array.isArray(values) || values.length === 0) {
		throw new TypeError('median requires at least one numeric observation.');
	}
	if (!values.every((value) => Number.isFinite(value) && value >= 0)) {
		throw new TypeError('median observations must be finite non-negative numbers.');
	}
	const ordered = [...values].sort((left, right) => left - right);
	const midpoint = Math.floor(ordered.length / 2);
	return ordered.length % 2 === 0
		? (ordered[midpoint - 1] + ordered[midpoint]) / 2
		: ordered[midpoint];
}

export function summarizePerformanceRuns(stateId, runs) {
	const state = BLACKSITE_PERFORMANCE_BUDGET.states[stateId];
	if (!state) throw new Error(`Unknown BLACKSITE performance state: ${stateId}`);
	if (!Array.isArray(runs) || runs.length < BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState) {
		throw new Error(
			`${stateId} requires at least ${BLACKSITE_PERFORMANCE_BUDGET.minimumRunsPerState} runs.`,
		);
	}

	const metrics = Object.fromEntries(
		METRIC_KEYS.map((metric) => {
			const observations = runs.map((run) => run[metric]);
			if (
				!observations.every(
					(value) =>
						Number.isFinite(value) &&
						value >= 0 &&
						(!POSITIVE_METRIC_KEYS.has(metric) || value > 0),
				)
			) {
				throw new Error(`${stateId} contains an invalid ${metric} observation.`);
			}
			const minimum = Math.min(...observations);
			const maximum = Math.max(...observations);
			return [
				metric,
				{
					observations,
					min: minimum,
					median: median(observations),
					max: maximum,
					range: maximum - minimum,
					ceiling: state.ceilings[metric],
				},
			];
		}),
	);
	for (const [index, run] of runs.entries()) {
		if (run.stateId !== stateId || run.run !== index + 1) {
			throw new Error(`${stateId} runs must use matching state IDs and consecutive one-based IDs.`);
		}
		if (run.completeMs < run.readyMs) {
			throw new Error(`${stateId} run ${index + 1} completes before its ready barrier.`);
		}
		if (run.frameIntervalMaxMs < run.frameIntervalP95Ms) {
			throw new Error(`${stateId} run ${index + 1} has inconsistent frame intervals.`);
		}
		if (
			!Number.isSafeInteger(run.frameIntervalsOver50Count) ||
			run.frameIntervalsOver50Count < 0 ||
			!Number.isSafeInteger(run.decodedBodyBytes) ||
			run.decodedBodyBytes <= 0
		) {
			throw new Error(`${stateId} run ${index + 1} has invalid discrete metrics.`);
		}
		const navigation = run.navigation;
		if (
			!navigation ||
			!Number.isFinite(navigation.responseEndMs) ||
			navigation.responseEndMs <= 0 ||
			!Number.isFinite(navigation.domInteractiveMs) ||
			navigation.domInteractiveMs <= 0 ||
			!Number.isFinite(navigation.domContentLoadedMs) ||
			navigation.domContentLoadedMs < navigation.domInteractiveMs ||
			!Number.isFinite(navigation.loadEventEndMs) ||
			navigation.loadEventEndMs < navigation.domContentLoadedMs
		) {
			throw new Error(`${stateId} run ${index + 1} has an invalid navigation entry.`);
		}
	}
	const failures = Object.entries(metrics)
		.filter(([, metric]) => metric.observations.some((value) => value > metric.ceiling))
		.map(([metric, value]) => ({
			metric,
			observedMax: value.max,
			ceiling: value.ceiling,
			overBudgetRuns: value.observations
				.map((observation, index) => ({ run: index + 1, observation }))
				.filter(({ observation }) => observation > value.ceiling),
		}));

	return {
		stateId,
		runs: runs.length,
		evaluation: BLACKSITE_PERFORMANCE_BUDGET.aggregation.method,
		metrics,
		status: failures.length === 0 ? 'PASS' : 'FAIL',
		failures,
	};
}

export const BLACKSITE_PERFORMANCE_METRIC_KEYS = METRIC_KEYS;
