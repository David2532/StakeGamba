const DEFAULT_REFRESH_HZ = 60;
const MIN_SAMPLE_COUNT = 24;
const MAX_SAMPLE_COUNT = 90;
const PUBLISH_INTERVAL_MS = 500;
const QUALITY_DOWNGRADE_WINDOWS = 2;
const QUALITY_RECOVERY_WINDOWS = 3;
const REFRESH_BASELINE_CHANGE_WINDOWS = 2;
const REFRESH_BASELINE_STEADY_TOLERANCE = 0.08;
const REFRESH_BASELINE_CANDIDATE_TOLERANCE = 0.06;
const QUALITY_RANK = Object.freeze({ full: 0, balanced: 1, reduced: 2 });

function finitePositive(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function percentile(values, ratio) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function roundMetric(value, precision = 1) {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

function snapshotsEquivalent(left, right) {
	if (!left || !right) return false;
	return left.refreshHz === right.refreshHz
		&& left.quality === right.quality
		&& Math.abs(left.renderFps - right.renderFps) < 0.5
		&& Math.abs(left.frameTimeMs - right.frameTimeMs) < 0.25
		&& Math.abs(left.p95FrameTimeMs - right.p95FrameTimeMs) < 0.5
		&& Math.abs(left.missedFrameRate - right.missedFrameRate) < 0.005;
}

export class DisplayRefreshMonitor {
	constructor({
		requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
		cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
		onChange = () => {},
		documentObject = globalThis.document,
	} = {}) {
		if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
			throw new TypeError('DisplayRefreshMonitor requires requestAnimationFrame and cancelAnimationFrame.');
		}
		this.requestFrame = requestFrame;
		this.cancelFrame = cancelFrame;
		this.onChange = typeof onChange === 'function' ? onChange : () => {};
		this.documentObject = documentObject;
		this.frameHandle = null;
		this.lastTimestamp = null;
		this.samples = [];
		this.lastPublishedAt = 0;
		this.lastNotifiedSnapshot = null;
		this.badQualityWindows = 0;
		this.goodQualityWindows = 0;
		this.visibilityListening = false;
		this.running = false;
		this.refreshFrameMs = 1000 / DEFAULT_REFRESH_HZ;
		this.pendingRefreshFrameMs = null;
		this.pendingRefreshWindows = 0;
		this.snapshot = Object.freeze({
			refreshHz: DEFAULT_REFRESH_HZ,
			renderFps: DEFAULT_REFRESH_HZ,
			frameTimeMs: 1000 / DEFAULT_REFRESH_HZ,
			p95FrameTimeMs: 1000 / DEFAULT_REFRESH_HZ,
			missedFrameRate: 0,
			quality: 'full',
			sampleCount: 0,
		});
		this.tick = this.tick.bind(this);
		this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
	}

	start() {
		if (this.running) return this.snapshot;
		this.running = true;
		this.attachVisibilityListener();
		this.resetSampling();
		if (!this.isDocumentHidden()) this.scheduleFrame();
		return this.snapshot;
	}

	stop() {
		this.running = false;
		this.cancelScheduledFrame();
		this.detachVisibilityListener();
		this.resetSampling();
	}

	destroy() {
		this.stop();
	}

	isDocumentHidden() {
		return this.documentObject?.hidden === true || this.documentObject?.visibilityState === 'hidden';
	}

	attachVisibilityListener() {
		if (this.visibilityListening || typeof this.documentObject?.addEventListener !== 'function') return;
		this.documentObject.addEventListener('visibilitychange', this.handleVisibilityChange);
		this.visibilityListening = true;
	}

	detachVisibilityListener() {
		if (!this.visibilityListening || typeof this.documentObject?.removeEventListener !== 'function') return;
		this.documentObject.removeEventListener('visibilitychange', this.handleVisibilityChange);
		this.visibilityListening = false;
	}

	scheduleFrame() {
		if (!this.running || this.frameHandle !== null || this.isDocumentHidden()) return;
		this.frameHandle = this.requestFrame(this.tick);
	}

	cancelScheduledFrame() {
		if (this.frameHandle !== null) this.cancelFrame(this.frameHandle);
		this.frameHandle = null;
	}

	resetSampling() {
		this.lastTimestamp = null;
		this.samples.length = 0;
		this.lastPublishedAt = 0;
		this.lastNotifiedSnapshot = null;
		this.badQualityWindows = 0;
		this.goodQualityWindows = 0;
		this.refreshFrameMs = 1000 / DEFAULT_REFRESH_HZ;
		this.pendingRefreshFrameMs = null;
		this.pendingRefreshWindows = 0;
	}

	handleVisibilityChange() {
		if (!this.running) return;
		if (this.isDocumentHidden()) {
			this.cancelScheduledFrame();
			this.resetSampling();
			return;
		}
		this.resetSampling();
		this.scheduleFrame();
	}

	tick(timestamp) {
		this.frameHandle = null;
		if (!this.running) return;
		if (this.isDocumentHidden()) {
			this.resetSampling();
			return;
		}
		if (this.lastTimestamp !== null) {
			const delta = timestamp - this.lastTimestamp;
			if (delta >= 2 && delta <= 250) {
				this.samples.push(delta);
				if (this.samples.length > MAX_SAMPLE_COUNT) this.samples.shift();
			}
		}
		this.lastTimestamp = timestamp;

		if (
			this.samples.length >= MIN_SAMPLE_COUNT
			&& (this.lastPublishedAt === 0 || timestamp - this.lastPublishedAt >= PUBLISH_INTERVAL_MS)
		) {
			this.publish(timestamp);
		}
		this.scheduleFrame();
	}

	resolveQuality(candidate) {
		const current = this.snapshot.quality;
		const currentRank = QUALITY_RANK[current] ?? QUALITY_RANK.full;
		const candidateRank = QUALITY_RANK[candidate] ?? QUALITY_RANK.full;
		if (candidateRank > currentRank) {
			this.badQualityWindows += 1;
			this.goodQualityWindows = 0;
			if (this.badQualityWindows >= QUALITY_DOWNGRADE_WINDOWS) {
				this.badQualityWindows = 0;
				return candidate;
			}
			return current;
		}
		if (candidateRank < currentRank) {
			this.goodQualityWindows += 1;
			this.badQualityWindows = 0;
			if (this.goodQualityWindows >= QUALITY_RECOVERY_WINDOWS) {
				this.goodQualityWindows = 0;
				return candidate;
			}
			return current;
		}
		this.badQualityWindows = 0;
		this.goodQualityWindows = 0;
		return current;
	}

	resolveRefreshFrameMs(candidate) {
		const current = finitePositive(this.refreshFrameMs, 1000 / DEFAULT_REFRESH_HZ);
		if (!Number.isFinite(candidate) || candidate <= 0) return current;

		const relativeChange = Math.abs(candidate - current) / current;
		if (relativeChange <= REFRESH_BASELINE_STEADY_TOLERANCE) {
			this.pendingRefreshFrameMs = null;
			this.pendingRefreshWindows = 0;
			this.refreshFrameMs = candidate;
			return this.refreshFrameMs;
		}

		const pending = this.pendingRefreshFrameMs;
		const candidateIsStable = pending !== null
			&& Math.abs(candidate - pending) / pending <= REFRESH_BASELINE_CANDIDATE_TOLERANCE;
		if (!candidateIsStable) {
			this.pendingRefreshFrameMs = candidate;
			this.pendingRefreshWindows = 1;
			return current;
		}

		this.pendingRefreshFrameMs = (pending + candidate) / 2;
		this.pendingRefreshWindows += 1;
		if (this.pendingRefreshWindows < REFRESH_BASELINE_CHANGE_WINDOWS) return current;

		this.refreshFrameMs = this.pendingRefreshFrameMs;
		this.pendingRefreshFrameMs = null;
		this.pendingRefreshWindows = 0;
		return this.refreshFrameMs;
	}

	publish(timestamp) {
		const ordered = [...this.samples].sort((left, right) => left - right);
		const median = ordered[Math.floor(ordered.length / 2)];
		const baselineCandidate = percentile(ordered, 0.2);
		const refreshFrameMs = this.resolveRefreshFrameMs(baselineCandidate);
		const refreshHz = Math.max(30, Math.min(360, Math.round(1000 / refreshFrameMs)));
		const renderFps = roundMetric(1000 / finitePositive(median, 1000 / DEFAULT_REFRESH_HZ));
		const p95FrameTimeMs = percentile(ordered, 0.95);
		const budgetMs = 1000 / refreshHz;
		const missedFrames = ordered.reduce(
			(total, delta) => total + Math.max(0, Math.round(delta / budgetMs) - 1),
			0,
		);
		const missedFrameRate = missedFrames / Math.max(1, ordered.length + missedFrames);
		const qualityCandidate = p95FrameTimeMs > Math.max(26, budgetMs * 1.85) || missedFrameRate > 0.22
			? 'reduced'
			: p95FrameTimeMs > Math.max(19, budgetMs * 1.35) || missedFrameRate > 0.08
				? 'balanced'
				: 'full';
		const nextSnapshot = Object.freeze({
			refreshHz,
			renderFps,
			frameTimeMs: roundMetric(median),
			p95FrameTimeMs: roundMetric(p95FrameTimeMs),
			missedFrameRate: roundMetric(missedFrameRate, 3),
			quality: this.resolveQuality(qualityCandidate),
			sampleCount: ordered.length,
		});
		this.lastPublishedAt = timestamp;
		this.snapshot = nextSnapshot;
		if (snapshotsEquivalent(nextSnapshot, this.lastNotifiedSnapshot)) return;
		this.lastNotifiedSnapshot = nextSnapshot;
		try {
			this.onChange(nextSnapshot);
		} catch {
			// Refresh telemetry is cosmetic and must never affect gameplay.
		}
	}
}
