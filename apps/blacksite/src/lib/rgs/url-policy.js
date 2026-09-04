const EXACT_QA_HTTP_LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '[::1]']);

/**
 * Production RGS traffic is HTTPS-only. The opt-ins are deliberately available
 * only to code-owned development/QA callers and only for numeric loopback
 * destinations; launch query parameters cannot enable either one.
 */
export function normalizeTrustedRgsBaseUrl(
	rawValue,
	{ allowHttpLoopbackForDevelopment = false, allowHttpLoopbackForExactQa = false } = {},
) {
	if (typeof rawValue !== 'string' || rawValue.trim() === '') return null;

	let url;
	try {
		url = new URL(rawValue);
	} catch {
		return null;
	}

	const secureTransport = url.protocol === 'https:';
	const codeOwnedLoopbackTransport =
		(allowHttpLoopbackForDevelopment === true || allowHttpLoopbackForExactQa === true) &&
		url.protocol === 'http:' &&
		EXACT_QA_HTTP_LOOPBACK_HOSTNAMES.has(url.hostname);

	if (
		(!secureTransport && !codeOwnedLoopbackTransport) ||
		!url.hostname ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.href.includes('?') ||
		url.href.includes('#')
	) {
		return null;
	}

	return url.toString().replace(/\/+$/, '');
}
