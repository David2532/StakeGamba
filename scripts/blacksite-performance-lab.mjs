import {
	BLACKSITE_PERFORMANCE_BUDGET,
	summarizePerformanceRuns,
} from './blacksite-performance-budget.mjs';

const EVENT_TIMING_THRESHOLD_MS = 16;

export function createPerformanceEvidence() {
	return {
		schema: 'blacksite-performance-lab-evidence-v1',
		measurementKind: BLACKSITE_PERFORMANCE_BUDGET.measurementKind,
		fieldData: false,
		fieldDataStatus: 'NOT_COLLECTED',
		fieldDataReason:
			'Exact-package CI uses controlled loopback Playwright; an authorized deployed RUM/CrUX source is not available.',
		budget: BLACKSITE_PERFORMANCE_BUDGET,
		environment: null,
		runs: [],
		summaries: [],
		summary: null,
	};
}

export async function installPerformanceLabObservers(context) {
	await context.addInitScript(
		({ eventTimingThresholdMs }) => {
			const supportedEntryTypes = globalThis.PerformanceObserver?.supportedEntryTypes ?? [];
			const state = {
				supportedEntryTypes: [...supportedEntryTypes],
				lcpEntries: [],
				layoutShiftEntries: [],
				longTaskEntries: [],
				interactionEntries: [],
				firstInputEntries: [],
				primaryInteraction: null,
				frameTimes: [],
				frameRequestId: 0,
				observers: [],
				observerErrors: [],
			};
			globalThis.__blacksitePerformanceLab = state;

			const observe = (type, callback, options = {}) => {
				if (!supportedEntryTypes.includes(type)) return;
				try {
					const observer = new PerformanceObserver((list) => callback(list.getEntries()));
					observer.observe({ type, buffered: true, ...options });
					state.observers.push({ observer, callback });
				} catch (error) {
					state.observerErrors.push({
						type,
						message: error instanceof Error ? error.message : String(error),
					});
				}
			};

			observe('largest-contentful-paint', (entries) => {
				for (const entry of entries) state.lcpEntries.push({ startTime: entry.startTime });
			});
			observe('layout-shift', (entries) => {
				for (const entry of entries) {
					state.layoutShiftEntries.push({
						startTime: entry.startTime,
						value: entry.value,
						hadRecentInput: entry.hadRecentInput,
					});
				}
			});
			observe('longtask', (entries) => {
				for (const entry of entries) state.longTaskEntries.push({ duration: entry.duration });
			});
			observe(
				'event',
				(entries) => {
					for (const entry of entries) {
						if (entry.interactionId > 0) {
							state.interactionEntries.push({
								name: entry.name,
								startTime: entry.startTime,
								interactionId: entry.interactionId,
								duration: entry.duration,
								targetTestId: entry.target?.getAttribute?.('data-testid') ?? null,
							});
						}
					}
				},
				{ durationThreshold: eventTimingThresholdMs },
			);
			observe('first-input', (entries) => {
				for (const entry of entries)
					state.firstInputEntries.push({
						name: entry.name,
						startTime: entry.startTime,
						duration: entry.duration,
						targetTestId: entry.target?.getAttribute?.('data-testid') ?? null,
					});
			});

			const sampleFrame = (at) => {
				state.frameTimes.push(at);
				state.frameRequestId = requestAnimationFrame(sampleFrame);
			};
			state.frameRequestId = requestAnimationFrame(sampleFrame);
		},
		{ eventTimingThresholdMs: EVENT_TIMING_THRESHOLD_MS },
	);
}

export async function armPerformancePrimaryInteraction(page, selector) {
	await page.evaluate((primarySelector) => {
		const state = globalThis.__blacksitePerformanceLab;
		if (!state) throw new Error('BLACKSITE performance observers were not installed.');
		const primary = document.querySelector(primarySelector);
		if (!primary) throw new Error('BLACKSITE primary performance action was not found.');
		state.interactionEntries.length = 0;
		state.firstInputEntries.length = 0;
		state.primaryInteraction = {
			selector: primarySelector,
			testId: primary.getAttribute('data-testid'),
			armedAt: performance.now(),
			trustedClickCount: 0,
		};
		primary.addEventListener(
			'click',
			(event) => {
				if (event.isTrusted) state.primaryInteraction.trustedClickCount += 1;
			},
			{ capture: true, once: true },
		);
	}, selector);
}

export async function capturePerformanceLabRun(page, { stateId, run, readyMs, completeMs }) {
	await page.evaluate(async () => {
		await document.fonts?.ready;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});

	const captured = await page.evaluate(
		({ eventTimingThresholdMs }) => {
			const state = globalThis.__blacksitePerformanceLab;
			if (!state) throw new Error('BLACKSITE performance observers were not installed.');
			cancelAnimationFrame(state.frameRequestId);
			for (const { observer, callback } of state.observers) {
				callback(observer.takeRecords());
				observer.disconnect();
			}

			const navigation = performance.getEntriesByType('navigation')[0];
			const resources = performance
				.getEntriesByType('resource')
				.filter((entry) => new URL(entry.name).origin === location.origin);
			const decodedBodyBytes = [navigation, ...resources].reduce(
				(sum, entry) => sum + (Number.isFinite(entry?.decodedBodySize) ? entry.decodedBodySize : 0),
				0,
			);
			const frameIntervals = state.frameTimes
				.slice(1)
				.map((time, index) => time - state.frameTimes[index])
				.filter((duration) => Number.isFinite(duration) && duration >= 0)
				.sort((left, right) => left - right);
			const frameP95Index = Math.max(0, Math.ceil(frameIntervals.length * 0.95) - 1);
			const primaryInteraction = state.primaryInteraction;
			const primaryEntries = state.interactionEntries.filter(
				(entry) =>
					entry.targetTestId === primaryInteraction?.testId &&
					entry.startTime >= primaryInteraction.armedAt,
			);
			const interactionDurations = new Map();
			for (const entry of primaryEntries) {
				interactionDurations.set(
					entry.interactionId,
					Math.max(interactionDurations.get(entry.interactionId) ?? 0, entry.duration),
				);
			}
			const exactInteractionDurations = [...interactionDurations.values()];
			const primaryFirstInput = state.firstInputEntries.find(
				(entry) =>
					entry.targetTestId === primaryInteraction?.testId &&
					entry.startTime >= primaryInteraction.armedAt,
			);
			const firstInputDuration = primaryFirstInput?.duration ?? null;
			const eventTimingSupported = state.supportedEntryTypes.includes('event');
			const shifts = state.layoutShiftEntries
				.filter((entry) => !entry.hadRecentInput)
				.sort((left, right) => left.startTime - right.startTime);
			let cls = 0;
			let sessionValue = 0;
			let sessionStart = 0;
			let previousShift = 0;
			for (const shift of shifts) {
				if (
					sessionValue === 0 ||
					shift.startTime - previousShift >= 1_000 ||
					shift.startTime - sessionStart >= 5_000
				) {
					sessionValue = shift.value;
					sessionStart = shift.startTime;
				} else {
					sessionValue += shift.value;
				}
				previousShift = shift.startTime;
				cls = Math.max(cls, sessionValue);
			}

			return {
				support: {
					largestContentfulPaint: state.supportedEntryTypes.includes('largest-contentful-paint'),
					layoutShift: state.supportedEntryTypes.includes('layout-shift'),
					longTask: state.supportedEntryTypes.includes('longtask'),
					eventTiming: eventTimingSupported,
					firstInput: state.supportedEntryTypes.includes('first-input'),
				},
				observerErrors: state.observerErrors,
				lcpMs: state.lcpEntries.at(-1)?.startTime ?? null,
				cls,
				lifecycleLongTaskBlockingMs: state.longTaskEntries.reduce(
					(sum, entry) => sum + Math.max(0, entry.duration - 50),
					0,
				),
				scriptedInteractionLatencyMs: exactInteractionDurations.length
					? Math.max(...exactInteractionDurations)
					: firstInputDuration,
				eventTimingSource: exactInteractionDurations.length ? 'event' : 'first-input',
				eventTimingThresholdMs,
				interactionCount: exactInteractionDurations.length || (firstInputDuration !== null ? 1 : 0),
				primaryInteraction: primaryInteraction
					? {
							...primaryInteraction,
							observedEntryCount: primaryEntries.length + (primaryFirstInput ? 1 : 0),
						}
					: null,
				frameSamples: frameIntervals.length,
				frameIntervalP95Ms: frameIntervals[frameP95Index] ?? null,
				frameIntervalMaxMs: frameIntervals.at(-1) ?? null,
				frameIntervalsOver50Count: frameIntervals.filter((duration) => duration > 50).length,
				decodedBodyBytes,
				resourceCount: resources.length,
				navigation: navigation
					? {
							responseEndMs: navigation.responseEnd,
							domInteractiveMs: navigation.domInteractive,
							domContentLoadedMs: navigation.domContentLoadedEventEnd,
							loadEventEndMs: navigation.loadEventEnd,
						}
					: null,
			};
		},
		{ eventTimingThresholdMs: EVENT_TIMING_THRESHOLD_MS },
	);

	for (const metric of [
		'lcpMs',
		'scriptedInteractionLatencyMs',
		'cls',
		'lifecycleLongTaskBlockingMs',
		'frameIntervalP95Ms',
		'frameIntervalMaxMs',
		'frameIntervalsOver50Count',
		'decodedBodyBytes',
	]) {
		if (!Number.isFinite(captured[metric]) || captured[metric] < 0) {
			throw new Error(`${stateId} run ${run} did not produce a finite ${metric} metric.`);
		}
	}
	if (Object.values(captured.support).some((supported) => !supported)) {
		throw new Error(`${stateId} run ${run} lacks required Chromium performance entry support.`);
	}
	if (captured.observerErrors.length > 0) {
		throw new Error(`${stateId} run ${run} reported PerformanceObserver errors.`);
	}
	if (
		!captured.navigation ||
		!Object.values(captured.navigation).every((value) => Number.isFinite(value) && value >= 0)
	) {
		throw new Error(`${stateId} run ${run} did not capture a valid navigation entry.`);
	}
	if (captured.interactionCount < 1) {
		throw new Error(`${stateId} run ${run} did not capture a trusted Event Timing interaction.`);
	}
	if (
		captured.primaryInteraction?.testId !== 'primary-action' ||
		captured.primaryInteraction?.trustedClickCount !== 1 ||
		captured.primaryInteraction?.observedEntryCount < 1
	) {
		throw new Error(`${stateId} run ${run} did not bind Event Timing to one primary action.`);
	}
	if (captured.frameSamples < 3) {
		throw new Error(`${stateId} run ${run} captured fewer than three frame intervals.`);
	}

	return { stateId, run, readyMs, completeMs, ...captured };
}

export function summarizePerformanceState(stateId, runs) {
	return summarizePerformanceRuns(stateId, runs);
}
