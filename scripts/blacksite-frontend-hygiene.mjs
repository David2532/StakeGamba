import { createHash } from 'node:crypto';
import {
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { Script } from 'node:vm';

const requireFromBlacksite = createRequire(
	new URL('../apps/blacksite/package.json', import.meta.url),
);
const { parse: parseSvelteDocument } = requireFromBlacksite('svelte/compiler');

const staticPrefix = 'apps/blacksite/static/';
const buildIdentityPath = '_app/blacksite-build-identity.json';
const recoveryMetadataPath = '_app/version.json';
const exactGitShaPattern = /^[0-9a-f]{40}$/u;
const generatedInlineResidue = Object.freeze(['_app/immutable', '_app/env.js']);
const textExtensions = new Set([
	'.atlas',
	'.cjs',
	'.css',
	'.csv',
	'.frag',
	'.glsl',
	'.gltf',
	'.html',
	'.js',
	'.json',
	'.mjs',
	'.svg',
	'.txt',
	'.vert',
	'.webmanifest',
	'.xml',
]);
const forbiddenSecretContent = Object.freeze([
	{
		label: 'private key',
		pattern: /-----BEGIN (?:[A-Z0-9][A-Z0-9 ]* )?PRIVATE KEY(?: BLOCK)?-----/u,
	},
	{ label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u },
	{
		label: 'GitHub token',
		pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
	},
	{ label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/u },
	{ label: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/u },
	{ label: 'Stripe key', pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/u },
]);
const releaseAssetStatuses = new Set(['approved', 'production', 'production-candidate']);
const forbiddenRuntimeCodeExtensions = new Set([
	'.cjs',
	'.css',
	'.htm',
	'.html',
	'.js',
	'.mjs',
	'.shtml',
	'.svg',
	'.wasm',
	'.xht',
	'.xhtml',
]);
const compiledInlineSvgSpriteEmbedding = 'compiled-inline-svg-sprite';
const compiledInlineSvgSpriteType = 'symbol-family-inline-vector-sprite';
const compiledInlineSvgSpriteFormat = 'svelte-inline-svg-symbol-sprite';
const safeInlineSvgElements = new Set([
	'circle',
	'defs',
	'ellipse',
	'g',
	'line',
	'path',
	'polygon',
	'polyline',
	'rect',
	'svg',
	'symbol',
]);
const inlineSvgGeometryElements = new Set([
	'circle',
	'ellipse',
	'line',
	'path',
	'polygon',
	'polyline',
	'rect',
]);

function fail(message) {
	throw new Error(message);
}

function normalizedRelativePath(root, path) {
	return relative(root, path).replaceAll('\\', '/');
}

function collectRegularFiles(root, target = root, output = []) {
	const stats = lstatSync(target);
	if (stats.isFile()) {
		output.push(target);
		return output;
	}
	if (!stats.isDirectory()) fail(`Unsupported frontend package entry: ${target}`);
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((left, right) =>
		left.name.localeCompare(right.name, 'en'),
	)) {
		const child = join(target, entry.name);
		if (entry.isDirectory()) collectRegularFiles(root, child, output);
		else if (entry.isFile()) output.push(child);
		else fail(`Unsupported frontend package entry: ${normalizedRelativePath(root, child)}`);
	}
	return output;
}

export function assertPhysicalPackageDirectory(path, context = 'Package directory') {
	const root = resolve(path);
	if (!existsSync(root)) fail(`${context} is missing: ${root}`);
	const stats = lstatSync(root);
	if (stats.isSymbolicLink() || !stats.isDirectory()) {
		fail(`${context} must be a physical directory, not a link or special entry: ${root}`);
	}
	if (realpathSync(root) !== root) {
		fail(`${context} must not resolve through a symbolic-link ancestor: ${root}`);
	}
	return root;
}

function fileFact(path) {
	const bytes = readFileSync(path);
	return {
		bytes: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
	};
}

function decodedTextViews(bytes) {
	const views = [bytes.toString('utf8')];
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		views.push(bytes.subarray(2).toString('utf16le'));
	} else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const swapped = Buffer.from(bytes.subarray(2));
		swapped.swap16();
		views.push(swapped.toString('utf16le'));
	} else {
		const sampleLength = Math.min(bytes.length - (bytes.length % 2), 256);
		const pairs = sampleLength / 2;
		let evenNulls = 0;
		let oddNulls = 0;
		for (let index = 0; index < sampleLength; index += 2) {
			if (bytes[index] === 0) evenNulls += 1;
			if (bytes[index + 1] === 0) oddNulls += 1;
		}
		if (pairs >= 4 && oddNulls / pairs >= 0.3 && evenNulls / pairs <= 0.1) {
			views.push(bytes.subarray(0, bytes.length - (bytes.length % 2)).toString('utf16le'));
		} else if (pairs >= 4 && evenNulls / pairs >= 0.3 && oddNulls / pairs <= 0.1) {
			const swapped = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2)));
			swapped.swap16();
			views.push(swapped.toString('utf16le'));
		}
	}
	return views;
}

function decodeCharacterReferences(source) {
	return source
		.replace(/&#x([0-9a-f]+);?/giu, (match, hex) => {
			const codePoint = Number.parseInt(hex, 16);
			return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: match;
		})
		.replace(/&#([0-9]+);?/gu, (match, decimal) => {
			const codePoint = Number.parseInt(decimal, 10);
			return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
				? String.fromCodePoint(codePoint)
				: match;
		})
		.replace(/&colon;?/giu, ':');
}

function decodeCssEscapes(source) {
	return source
		.replace(/\\(?:\r\n|[\n\r\f])/gu, '')
		.replace(/\\([0-9a-f]{1,6})\s?|\\([^\r\n\f0-9a-f])/giu, (match, hex, escaped) => {
			if (hex) {
				const codePoint = Number.parseInt(hex, 16);
				return codePoint === 0 || codePoint > 0x10ffff ? '\ufffd' : String.fromCodePoint(codePoint);
			}
			return escaped ?? match;
		});
}

function cssWithoutComments(source) {
	let output = '';
	let quote = null;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			output += character;
			if (character === '\\' && index + 1 < source.length) output += source[(index += 1)];
			else if (character === quote) quote = null;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			output += character;
			continue;
		}
		if (character === '/' && source[index + 1] === '*') {
			const end = source.indexOf('*/', index + 2);
			index = end < 0 ? source.length : end + 1;
			continue;
		}
		output += character;
	}
	return output;
}

function decodeJavaScriptEscapes(source) {
	return source
		.replace(/\\u\{([0-9a-f]{1,6})\}/giu, (match, hex) => {
			const codePoint = Number.parseInt(hex, 16);
			return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
		})
		.replace(/\\u([0-9a-f]{4})/giu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/\\x([0-9a-f]{2})/giu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/\\([\\'"`])/gu, '$1');
}

function containsEffectiveDataUri(source) {
	const decoded = decodeCssEscapes(
		decodeJavaScriptEscapes(decodeCharacterReferences(source)),
	).replace(/[\t\n\r]/gu, '');
	const schemePattern = /\bdata:/giu;
	for (const match of decoded.matchAll(schemePattern)) {
		let index = (match.index ?? 0) + match[0].length;
		while (index < decoded.length && /\s/u.test(decoded[index])) index += 1;
		let quote = null;
		for (; index < decoded.length; index += 1) {
			const character = decoded[index];
			if (quote) {
				if (character === '\\' && index + 1 < decoded.length) index += 1;
				else if (character === quote) quote = null;
				continue;
			}
			if (character === '"' || character === "'") {
				quote = character;
				continue;
			}
			if (character === ',') return true;
			if (character === '<' || character === '>') break;
		}
	}
	return false;
}

function parseJavaScriptProgram(source) {
	try {
		new Script(source, { filename: 'blacksite-inline-runtime.js' });
		const parsed = parseSvelteDocument(`<script>${source}</script>`, { modern: true });
		if (parsed.instance?.content?.type !== 'Program') {
			fail('Generated inline runtime did not parse as a JavaScript program');
		}
		return parsed.instance.content;
	} catch (error) {
		fail(`Generated inline runtime is not syntactically executable: ${error.message}`);
	}
}

function walkSyntax(node, visitor, parent = null) {
	if (!node || typeof node !== 'object') return;
	visitor(node, parent);
	for (const [key, value] of Object.entries(node)) {
		if (['end', 'loc', 'start'].includes(key)) continue;
		if (Array.isArray(value)) {
			for (const child of value) walkSyntax(child, visitor, node);
		} else if (value && typeof value === 'object') {
			walkSyntax(value, visitor, node);
		}
	}
}

const unresolvedStaticValue = Symbol('unresolved static value');

function staticPrimitiveValue(node) {
	const unwrapped = unwrappedSyntax(node);
	if (!unwrapped) return unresolvedStaticValue;
	if (unwrapped.type === 'Literal') {
		if (
			unwrapped.value === null ||
			['bigint', 'boolean', 'number', 'string'].includes(typeof unwrapped.value)
		) {
			return unwrapped.value;
		}
		if (typeof unwrapped.bigint === 'string') {
			try {
				return BigInt(unwrapped.bigint);
			} catch {
				return unresolvedStaticValue;
			}
		}
		return unresolvedStaticValue;
	}
	if (unwrapped.type === 'TemplateLiteral') {
		let value = unwrapped.quasis[0]?.value?.cooked ?? unwrapped.quasis[0]?.value?.raw ?? '';
		for (let index = 0; index < unwrapped.expressions.length; index += 1) {
			const expression = staticPrimitiveValue(unwrapped.expressions[index]);
			if (expression === unresolvedStaticValue) return unresolvedStaticValue;
			value += String(expression);
			value +=
				unwrapped.quasis[index + 1]?.value?.cooked ?? unwrapped.quasis[index + 1]?.value?.raw ?? '';
		}
		return value;
	}
	if (unwrapped.type === 'ConditionalExpression') {
		const condition = staticPrimitiveValue(unwrapped.test);
		if (condition === unresolvedStaticValue) return unresolvedStaticValue;
		return staticPrimitiveValue(condition ? unwrapped.consequent : unwrapped.alternate);
	}
	if (unwrapped.type === 'SequenceExpression' && unwrapped.expressions.length > 0) {
		return staticPrimitiveValue(unwrapped.expressions.at(-1));
	}
	if (unwrapped.type === 'LogicalExpression') {
		const left = staticPrimitiveValue(unwrapped.left);
		if (left === unresolvedStaticValue) return unresolvedStaticValue;
		if (unwrapped.operator === '&&') {
			return left ? staticPrimitiveValue(unwrapped.right) : left;
		}
		if (unwrapped.operator === '||') {
			return left ? left : staticPrimitiveValue(unwrapped.right);
		}
		if (unwrapped.operator === '??') {
			return left === null || left === undefined ? staticPrimitiveValue(unwrapped.right) : left;
		}
		return unresolvedStaticValue;
	}
	if (unwrapped.type === 'UnaryExpression') {
		const argument = staticPrimitiveValue(unwrapped.argument);
		if (argument === unresolvedStaticValue) return unresolvedStaticValue;
		try {
			switch (unwrapped.operator) {
				case '!':
					return !argument;
				case '+':
					return +argument;
				case '-':
					return -argument;
				case '~':
					return ~argument;
				case 'typeof':
					return typeof argument;
				case 'void':
					return undefined;
				default:
					return unresolvedStaticValue;
			}
		} catch {
			return unresolvedStaticValue;
		}
	}
	if (unwrapped.type === 'BinaryExpression') {
		const left = staticPrimitiveValue(unwrapped.left);
		const right = staticPrimitiveValue(unwrapped.right);
		if (left === unresolvedStaticValue || right === unresolvedStaticValue) {
			return unresolvedStaticValue;
		}
		try {
			switch (unwrapped.operator) {
				case '+':
					return left + right;
				case '-':
					return left - right;
				case '*':
					return left * right;
				case '/':
					return left / right;
				case '%':
					return left % right;
				case '**':
					return left ** right;
				case '===':
					return left === right;
				case '!==':
					return left !== right;
				case '<':
					return left < right;
				case '<=':
					return left <= right;
				case '>':
					return left > right;
				case '>=':
					return left >= right;
				case '<<':
					return left << right;
				case '>>':
					return left >> right;
				case '>>>':
					return left >>> right;
				case '&':
					return left & right;
				case '|':
					return left | right;
				case '^':
					return left ^ right;
				default:
					return unresolvedStaticValue;
			}
		} catch {
			return unresolvedStaticValue;
		}
	}
	return unresolvedStaticValue;
}

function staticStringValue(node) {
	const value = staticPrimitiveValue(node);
	return value === unresolvedStaticValue ? null : String(value);
}

function staticAttributeValue(attribute) {
	if (attribute.type !== 'Attribute') return null;
	if (attribute.value === true) return '';
	if (!Array.isArray(attribute.value) || !attribute.value.every((part) => part.type === 'Text')) {
		return null;
	}
	return attribute.value.map((part) => part.data).join('');
}

function parsePinnedInlineDocument(content) {
	let ast;
	try {
		ast = parseSvelteDocument(content, { modern: true });
	} catch (error) {
		fail(`Invalid generated inline HTML: ${error.message}`);
	}
	const elements = [];
	const elementByNode = new Map();
	const attributeValues = [];
	const styleSources = [];
	const visitFragment = (fragment, ancestors = []) => {
		for (const node of fragment?.nodes ?? []) {
			if (node.type !== 'RegularElement') continue;
			const attributes = new Map();
			for (const attribute of node.attributes ?? []) {
				const value = staticAttributeValue(attribute);
				if (value === null) {
					fail(`Generated inline HTML contains a non-static ${node.name} attribute`);
				}
				if (attributes.has(attribute.name)) {
					fail(`Generated inline HTML repeats the ${attribute.name} attribute`);
				}
				attributes.set(attribute.name, value);
				attributeValues.push({ element: node.name, name: attribute.name, value });
				if (/^on/iu.test(attribute.name)) {
					fail(`Generated inline HTML contains forbidden inline event handler ${attribute.name}`);
				}
			}
			const record = { node, ancestors, attributes };
			elements.push(record);
			elementByNode.set(node, record);
			if (node.name === 'style') {
				const parts = node.fragment?.nodes ?? [];
				if (parts.length !== 1 || parts[0].type !== 'Text') {
					fail('Generated inline stylesheet must be one static text node');
				}
				styleSources.push(parts[0].data);
			}
			visitFragment(node.fragment, [...ancestors, record]);
		}
	};
	visitFragment(ast.fragment);
	const meaningfulChildren = (fragment) =>
		(fragment?.nodes ?? []).filter((node) => node.type !== 'Text' || node.data.trim() !== '');
	const expectAttributes = (element, expected, label) => {
		const entries = [...element.attributes.entries()];
		if (
			entries.length !== Object.keys(expected).length ||
			entries.some(([name, value]) => expected[name] !== value)
		) {
			fail(`Generated inline HTML ${label} attributes differ from the pinned build shape`);
		}
	};
	const rootChildren = meaningfulChildren(ast.fragment);
	if (
		rootChildren.length !== 2 ||
		rootChildren[0].type !== 'RegularElement' ||
		rootChildren[0].name !== '!doctype' ||
		rootChildren[1].type !== 'RegularElement' ||
		rootChildren[1].name !== 'html'
	) {
		fail('Generated inline HTML differs from the pinned document root shape');
	}
	const html = elementByNode.get(rootChildren[1]);
	expectAttributes(html, { lang: 'en' }, 'html');
	const htmlChildren = meaningfulChildren(html.node.fragment);
	if (
		htmlChildren.length !== 2 ||
		htmlChildren[0].type !== 'RegularElement' ||
		htmlChildren[0].name !== 'head' ||
		htmlChildren[1].type !== 'RegularElement' ||
		htmlChildren[1].name !== 'body'
	) {
		fail('Generated inline HTML differs from the pinned html/head/body shape');
	}
	const head = elementByNode.get(htmlChildren[0]);
	const body = elementByNode.get(htmlChildren[1]);
	expectAttributes(head, {}, 'head');
	expectAttributes(body, { 'data-sveltekit-preload-data': 'hover' }, 'body');
	const headChildren = meaningfulChildren(head.node.fragment);
	if (
		headChildren.length !== 4 ||
		headChildren.some((node) => node.type !== 'RegularElement') ||
		JSON.stringify(headChildren.map((node) => node.name)) !==
			JSON.stringify(['meta', 'meta', 'meta', 'style'])
	) {
		fail('Generated inline HTML differs from the pinned head shape');
	}
	expectAttributes(elementByNode.get(headChildren[0]), { charset: 'utf-8' }, 'charset meta');
	expectAttributes(
		elementByNode.get(headChildren[1]),
		{
			content: 'width=device-width, initial-scale=1, viewport-fit=cover',
			name: 'viewport',
		},
		'viewport meta',
	);
	expectAttributes(
		elementByNode.get(headChildren[2]),
		{ content: '#081015', name: 'theme-color' },
		'theme meta',
	);
	expectAttributes(elementByNode.get(headChildren[3]), {}, 'style');
	const bodyChildren = meaningfulChildren(body.node.fragment);
	if (
		bodyChildren.length !== 1 ||
		bodyChildren[0].type !== 'RegularElement' ||
		bodyChildren[0].name !== 'div'
	) {
		fail('Generated inline HTML differs from the pinned body shape');
	}
	const scripts = elements.filter((element) => element.node.name === 'script');
	if (scripts.length !== 1) {
		fail(
			`Inline package must contain exactly one generated runtime script; received ${scripts.length}`,
		);
	}
	const script = scripts[0];
	if (script.attributes.size !== 0) {
		fail('Generated runtime script must be inline and attribute-free');
	}
	const ancestorNames = script.ancestors.map((ancestor) => ancestor.node.name);
	if (JSON.stringify(ancestorNames) !== JSON.stringify(['html', 'body', 'div'])) {
		fail('Generated runtime script is outside the pinned html/body/div wrapper');
	}
	const wrapper = script.ancestors.at(-1);
	if (
		wrapper.attributes.size !== 1 ||
		wrapper.attributes.get('style')?.replaceAll(/\s+/gu, ' ').trim() !== 'display: contents'
	) {
		fail('Generated runtime wrapper does not match the pinned inline adapter shape');
	}
	const meaningfulWrapperChildren = meaningfulChildren(wrapper.node.fragment);
	if (meaningfulWrapperChildren.length !== 1 || meaningfulWrapperChildren[0] !== script.node) {
		fail('Generated runtime script must be the sole runtime-wrapper child');
	}
	const scriptParts = script.node.fragment?.nodes ?? [];
	if (scriptParts.length !== 1 || scriptParts[0].type !== 'Text') {
		fail('Generated runtime script must contain one static inline program');
	}
	const scriptProgram = parseJavaScriptProgram(scriptParts[0].data);
	return {
		attributeValues,
		scriptProgram,
		scriptSource: scriptParts[0].data,
		styleSources,
	};
}

function exactRuntimeScriptLiterals(program) {
	const literals = new Set();
	walkSyntax(program, (node) => {
		if (node.type === 'Literal' && typeof node.value === 'string') literals.add(node.value);
		if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
			literals.add(node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw ?? '');
		}
	});
	return literals;
}

function unwrappedSyntax(node) {
	return node?.type === 'ChainExpression' ? node.expression : node;
}

function memberPropertyName(node) {
	if (node?.type !== 'MemberExpression') return null;
	if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
	if (node.computed) return staticStringValue(node.property);
	return null;
}

function isBrowserWindowReference(node) {
	const unwrapped = unwrappedSyntax(node);
	if (unwrapped?.type === 'Identifier') {
		return ['frames', 'globalThis', 'parent', 'self', 'top', 'window'].includes(unwrapped.name);
	}
	if (unwrapped?.type !== 'MemberExpression') return false;
	const property = memberPropertyName(unwrapped);
	if (
		property === 'defaultView' &&
		unwrappedSyntax(unwrapped.object)?.type === 'Identifier' &&
		unwrappedSyntax(unwrapped.object).name === 'document'
	) {
		return true;
	}
	return (
		['frames', 'parent', 'self', 'top', 'window'].includes(property) &&
		isBrowserWindowReference(unwrapped.object)
	);
}

function isConsoleReference(node) {
	const unwrapped = unwrappedSyntax(node);
	if (unwrapped?.type === 'Identifier' && unwrapped.name === 'console') return true;
	return (
		unwrapped?.type === 'MemberExpression' &&
		memberPropertyName(unwrapped) === 'console' &&
		isBrowserWindowReference(unwrapped.object)
	);
}

function containsConsoleDebugMember(node) {
	const unwrapped = unwrappedSyntax(node);
	if (!unwrapped) return false;
	if (unwrapped.type === 'SequenceExpression') {
		return unwrapped.expressions.some((expression) => containsConsoleDebugMember(expression));
	}
	if (unwrapped.type !== 'MemberExpression') return false;
	if (
		isConsoleReference(unwrapped.object) &&
		['debug', 'log', 'trace'].includes(memberPropertyName(unwrapped))
	) {
		return true;
	}
	return containsConsoleDebugMember(unwrapped.object);
}

function scanExecutableDebugContent(path, program) {
	walkSyntax(program, (node) => {
		if (node.type === 'DebuggerStatement') {
			fail(`Forbidden release content debugger statement in ${path}`);
		}
		if (node.type === 'CallExpression' && containsConsoleDebugMember(node.callee)) {
			fail(`Forbidden release content console debug statement in ${path}`);
		}
		if (node.type === 'TaggedTemplateExpression' && containsConsoleDebugMember(node.tag)) {
			fail(`Forbidden release content console debug statement in ${path}`);
		}
	});
}

function containsLocallyConstantDataUri(program) {
	let found = false;
	walkSyntax(program, (node) => {
		if (found) return;
		const value = staticStringValue(node);
		if (value !== null && containsEffectiveDataUri(value)) found = true;
	});
	return found;
}

function compiledInlineSvgSpriteContract(source, asset, context) {
	let ast;
	try {
		ast = parseSvelteDocument(source, { modern: true });
	} catch (error) {
		fail(`${asset.id}: invalid ${context} inline SVG sprite: ${error.message}`);
	}
	if (ast.instance || ast.module) {
		fail(`${asset.id}: ${context} inline SVG sprite cannot contain executable component scripts`);
	}

	const normalizeClass = (value) =>
		value
			.split(/\s+/u)
			.filter((token) => token.length > 0 && !/^svelte-[0-9a-z]+$/u.test(token))
			.sort((left, right) => left.localeCompare(right, 'en'))
			.join(' ');
	const canonicalElement = (node) => {
		if (node?.type !== 'RegularElement' || !safeInlineSvgElements.has(node.name)) {
			fail(`${asset.id}: ${context} inline SVG sprite contains an unsupported element`);
		}
		const attributes = [];
		const names = new Set();
		for (const attribute of node.attributes ?? []) {
			if (attribute.type !== 'Attribute' || names.has(attribute.name)) {
				fail(`${asset.id}: ${context} inline SVG sprite attributes must be unique and static`);
			}
			let value = staticAttributeValue(attribute);
			if (value === null) {
				fail(`${asset.id}: ${context} inline SVG sprite attributes must be unique and static`);
			}
			if (attribute.name === 'class') value = normalizeClass(value);
			names.add(attribute.name);
			attributes.push([attribute.name, value]);
		}
		attributes.sort(([left], [right]) => left.localeCompare(right, 'en'));
		const children = [];
		for (const child of node.fragment?.nodes ?? []) {
			if (child.type === 'Text' && child.data.trim() === '') continue;
			if (child.type !== 'RegularElement') {
				fail(`${asset.id}: ${context} inline SVG sprite must contain static vector elements only`);
			}
			children.push(canonicalElement(child));
		}
		return { name: node.name, attributes, children };
	};
	const roots = (ast.fragment?.nodes ?? []).filter(
		(node) => node.type !== 'Text' || node.data.trim() !== '',
	);
	if (roots.length !== 1 || roots[0].type !== 'RegularElement' || roots[0].name !== 'svg') {
		fail(`${asset.id}: ${context} inline SVG sprite must contain exactly one SVG root`);
	}
	const tree = canonicalElement(roots[0]);
	const attributes = new Map(tree.attributes);
	if (
		attributes.get('data-testid') !== 'blacksite-symbol-sprite' ||
		attributes.get('aria-hidden') !== 'true' ||
		attributes.get('focusable') !== 'false'
	) {
		fail(`${asset.id}: ${context} inline SVG sprite root accessibility marker is invalid`);
	}
	if (
		!asset.dimensions ||
		asset.dimensions.unit !== 'viewBox' ||
		!Number.isSafeInteger(asset.dimensions.width) ||
		asset.dimensions.width <= 0 ||
		!Number.isSafeInteger(asset.dimensions.height) ||
		asset.dimensions.height <= 0
	) {
		fail(`${asset.id}: inline SVG sprite requires positive integer viewBox dimensions`);
	}
	const expectedViewBox = `0 0 ${asset.dimensions.width} ${asset.dimensions.height}`;
	if (attributes.get('viewBox') !== expectedViewBox) {
		fail(`${asset.id}: ${context} inline SVG sprite root viewBox does not match the manifest`);
	}
	if (tree.children.length !== 1 || tree.children[0].name !== 'defs') {
		fail(`${asset.id}: ${context} inline SVG sprite must contain one definitions block`);
	}
	const symbols = tree.children[0].children;
	if (symbols.length === 0 || symbols.some((symbol) => symbol.name !== 'symbol')) {
		fail(`${asset.id}: ${context} inline SVG sprite definitions must contain symbols only`);
	}
	const symbolIds = [];
	const seenSymbolIds = new Set();
	for (const symbol of symbols) {
		const symbolAttributes = new Map(symbol.attributes);
		const symbolId = symbolAttributes.get('id');
		if (
			typeof symbolId !== 'string' ||
			!/^blacksite-symbol-[a-z][a-z0-9-]{0,63}$/u.test(symbolId) ||
			seenSymbolIds.has(symbolId)
		) {
			fail(`${asset.id}: ${context} inline SVG sprite symbol IDs must be unique and static`);
		}
		if (symbolAttributes.get('viewBox') !== expectedViewBox) {
			fail(`${asset.id}: ${context} inline SVG sprite symbol viewBox does not match the manifest`);
		}
		let geometryCount = 0;
		walkSyntax(symbol, (node) => {
			if (inlineSvgGeometryElements.has(node.name)) geometryCount += 1;
		});
		if (geometryCount === 0) {
			fail(`${asset.id}: ${context} inline SVG sprite symbols require vector geometry`);
		}
		seenSymbolIds.add(symbolId);
		symbolIds.push(symbolId);
	}
	return {
		fingerprintSha256: createHash('sha256').update(JSON.stringify(tree)).digest('hex'),
		symbolIds,
	};
}

function runtimeAssetRecords(assetManifest, sourceRoot) {
	if (
		assetManifest?.schema !== 'blacksite-asset-manifest-v1' ||
		!Array.isArray(assetManifest.assets)
	) {
		fail('Invalid BLACKSITE asset manifest');
	}
	const externalRecords = [];
	const compiledInlineRecords = [];
	const ids = new Set();
	const paths = new Set();
	for (const asset of assetManifest.assets) {
		if (asset?.runtimeEligible !== true) continue;
		if (typeof asset.id !== 'string' || asset.id.length === 0 || ids.has(asset.id)) {
			fail('Runtime asset IDs must be unique non-empty strings');
		}
		if (typeof asset.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(asset.sha256)) {
			fail(`${asset.id}: runtime asset requires a lowercase SHA-256 digest`);
		}
		if (!releaseAssetStatuses.has(asset.status)) {
			fail(`${asset.id}: runtime asset status is not release-eligible`);
		}
		for (const field of ['source', 'originalityProvenance', 'licenseRights', 'reviewLimitations']) {
			if (typeof asset[field] !== 'string' || asset[field].trim().length === 0) {
				fail(`${asset.id}: runtime asset requires documented ${field}`);
			}
		}
		if (typeof asset.sourceSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(asset.sourceSha256)) {
			fail(`${asset.id}: runtime asset requires a source SHA-256 digest`);
		}
		if (
			typeof asset.path !== 'string' ||
			asset.path.length === 0 ||
			asset.path.startsWith('/') ||
			asset.path.includes('\\') ||
			asset.path.includes(':') ||
			posix.normalize(asset.path) !== asset.path ||
			asset.path.split('/').includes('..')
		) {
			fail(`${asset.id}: source path must be a canonical repo-relative POSIX path`);
		}
		let realSourcePath = null;
		if (sourceRoot) {
			const sourcePath = resolve(sourceRoot, ...asset.path.split('/'));
			const relativeSourcePath = relative(sourceRoot, sourcePath);
			if (
				relativeSourcePath === '..' ||
				relativeSourcePath.startsWith(`..${sep}`) ||
				isAbsolute(relativeSourcePath)
			) {
				fail(`${asset.id}: documented source asset escapes the source root`);
			}
			if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
				fail(`${asset.id}: documented source asset is missing: ${asset.path}`);
			}
			realSourcePath = realpathSync(sourcePath);
			const realRelativeSourcePath = relative(realpathSync(sourceRoot), realSourcePath);
			if (
				realRelativeSourcePath === '..' ||
				realRelativeSourcePath.startsWith(`..${sep}`) ||
				isAbsolute(realRelativeSourcePath)
			) {
				fail(`${asset.id}: documented source asset resolves outside the source root`);
			}
			if (fileFact(realSourcePath).sha256 !== asset.sourceSha256) {
				fail(`${asset.id}: source asset hash mismatch for ${asset.path}`);
			}
		}
		if (asset.runtimeEmbedding !== undefined) {
			if (asset.runtimeEmbedding !== compiledInlineSvgSpriteEmbedding) {
				fail(`${asset.id}: unsupported runtimeEmbedding ${String(asset.runtimeEmbedding)}`);
			}
			if (
				asset.runtimePath !== null ||
				asset.type !== compiledInlineSvgSpriteType ||
				asset.format !== compiledInlineSvgSpriteFormat
			) {
				fail(`${asset.id}: compiled inline SVG sprite manifest shape is invalid`);
			}
			if (!sourceRoot || !realSourcePath) {
				fail(`${asset.id}: compiled inline SVG sprite verification requires a source root`);
			}
			if (asset.sha256 !== asset.sourceSha256) {
				fail(`${asset.id}: compiled inline SVG sprite digests must identify the same source bytes`);
			}
			if (
				typeof asset.runtimeReference !== 'string' ||
				asset.runtimeReference.trim().length === 0
			) {
				fail(`${asset.id}: compiled inline SVG sprite requires a documented runtimeReference`);
			}
			const sourceContract = compiledInlineSvgSpriteContract(
				readFileSync(realSourcePath, 'utf8'),
				asset,
				'source',
			);
			compiledInlineRecords.push({
				id: asset.id,
				runtimeEmbedding: asset.runtimeEmbedding,
				sourcePath: asset.path,
				sha256: asset.sha256,
				sourceSha256: asset.sourceSha256,
				status: asset.status,
				symbolIds: sourceContract.symbolIds,
				svgFingerprintSha256: sourceContract.fingerprintSha256,
			});
		} else {
			if (
				typeof asset.runtimePath !== 'string' ||
				!asset.runtimePath.startsWith(staticPrefix) ||
				asset.runtimePath.includes('\\')
			) {
				fail(`${asset.id}: runtimePath must be a canonical POSIX path inside ${staticPrefix}`);
			}
			const path = asset.runtimePath.slice(staticPrefix.length).replaceAll('\\', '/');
			if (
				path.length === 0 ||
				path.startsWith('/') ||
				/[%?#]/u.test(path) ||
				/[\u0000-\u0020\u007f]/u.test(path) ||
				posix.normalize(path) !== path ||
				path.split('/').includes('..') ||
				paths.has(path)
			) {
				fail(`${asset.id}: runtime asset path must be unique and normalized`);
			}
			if (forbiddenRuntimeCodeExtensions.has(posix.extname(path).toLowerCase())) {
				fail(`${asset.id}: generated inline package cannot manifest external runtime code`);
			}
			paths.add(path);
			externalRecords.push({
				id: asset.id,
				path,
				sourcePath: asset.path,
				sha256: asset.sha256,
				sourceSha256: asset.sourceSha256,
				status: asset.status,
			});
		}
		ids.add(asset.id);
	}
	return {
		compiledInline: compiledInlineRecords.sort((left, right) =>
			left.id.localeCompare(right.id, 'en'),
		),
		external: externalRecords.sort((left, right) => left.path.localeCompare(right.path, 'en')),
	};
}

function scanForbiddenContent(root, files, inlineDocument) {
	for (const absolutePath of files) {
		const path = normalizedRelativePath(root, absolutePath);
		if (posix.extname(path).toLowerCase() === '.map') {
			fail(`Forbidden source map file in ${path}`);
		}
		const bytes = readFileSync(absolutePath);
		const views = decodedTextViews(bytes);
		for (const content of views) {
			for (const rule of forbiddenSecretContent) {
				if (rule.pattern.test(content)) {
					fail(`Forbidden release content ${rule.label} in ${path}`);
				}
			}
			if (path !== 'index.html' && containsEffectiveDataUri(content)) {
				fail(`Forbidden release content embedded data URI in ${path}`);
			}
		}
		const extension = posix.extname(path).toLowerCase();
		if (!textExtensions.has(extension)) continue;
		for (const content of views) {
			if (/[#@]\s*sourceMappingURL\s*=/u.test(content)) {
				fail(`Forbidden release content source map directive in ${path}`);
			}
			if (path === 'index.html') continue;
			if (containsEffectiveDataUri(extension === '.css' ? cssWithoutComments(content) : content)) {
				fail(`Forbidden release content embedded data URI in ${path}`);
			}
		}
	}
	for (const attribute of inlineDocument.attributeValues) {
		const value =
			attribute.name === 'style' ? cssWithoutComments(attribute.value) : attribute.value;
		if (containsEffectiveDataUri(value)) {
			fail(
				`Forbidden release content embedded data URI in index.html ${attribute.element}.${attribute.name}`,
			);
		}
	}
	for (const stylesheet of inlineDocument.styleSources) {
		if (containsEffectiveDataUri(cssWithoutComments(stylesheet))) {
			fail('Forbidden release content embedded data URI in index.html stylesheet');
		}
	}
	if (containsLocallyConstantDataUri(inlineDocument.scriptProgram)) {
		fail('Forbidden release content embedded data URI in index.html runtime');
	}
	scanExecutableDebugContent('index.html', inlineDocument.scriptProgram);
}

function isExactRecoveryFetchTarget(node) {
	if (node?.type === 'Literal') return node.value === `/${recoveryMetadataPath}`;
	if (node?.type !== 'TemplateLiteral') return false;
	if (node.expressions.length === 0) {
		return staticStringValue(node) === `/${recoveryMetadataPath}`;
	}
	return (
		node.expressions.length === 1 &&
		node.expressions[0]?.type === 'Identifier' &&
		(node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw) === '' &&
		(node.quasis[1]?.value?.cooked ?? node.quasis[1]?.value?.raw) === `/${recoveryMetadataPath}`
	);
}

function readInlineRuntimeVersion(program) {
	const candidates = [];
	walkSyntax(program, (node) => {
		if (node.type !== 'VariableDeclaration') return;
		for (let index = 0; index < node.declarations.length - 1; index += 1) {
			const version = node.declarations[index];
			const marker = node.declarations[index + 1];
			if (
				version.id?.type === 'Identifier' &&
				version.init?.type === 'Literal' &&
				typeof version.init.value === 'string' &&
				exactGitShaPattern.test(version.init.value) &&
				marker.init?.type === 'Literal' &&
				marker.init.value === 'sveltekit:snapshot'
			) {
				candidates.push({ variable: version.id.name, version: version.init.value });
			}
		}
	});
	const fetchesRecoveryMetadata = [];
	walkSyntax(program, (node) => {
		if (
			node.type === 'CallExpression' &&
			node.callee?.type === 'Identifier' &&
			node.callee.name === 'fetch' &&
			isExactRecoveryFetchTarget(node.arguments[0])
		) {
			fetchesRecoveryMetadata.push(node);
		}
	});
	const bindings = candidates.filter((candidate) => {
		let comparesVersion = false;
		walkSyntax(program, (node) => {
			if (
				node.type === 'BinaryExpression' &&
				node.operator === '!==' &&
				node.right?.type === 'Identifier' &&
				node.right.name === candidate.variable &&
				node.left?.type === 'MemberExpression' &&
				memberPropertyName(node.left) === 'version'
			) {
				comparesVersion = true;
			}
		});
		return comparesVersion && fetchesRecoveryMetadata.length === 1;
	});
	if (bindings.length !== 1) {
		fail(
			`Inline runtime must expose exactly one generated SvelteKit recovery binding; received ${bindings.length}`,
		);
	}
	return bindings[0].version;
}

function readRecoveryMetadata(root) {
	const path = join(root, ...recoveryMetadataPath.split('/'));
	let metadata;
	try {
		metadata = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		fail(`Invalid ${recoveryMetadataPath}: ${error.message}`);
	}
	if (
		!metadata ||
		typeof metadata !== 'object' ||
		Array.isArray(metadata) ||
		typeof metadata.version !== 'string' ||
		!exactGitShaPattern.test(metadata.version)
	) {
		fail(`${recoveryMetadataPath} must contain the exact lowercase Git SHA build version`);
	}
	return metadata.version;
}

export function pruneBlacksiteInlineBuildResidue(buildRoot) {
	const root = resolve(buildRoot);
	const indexPath = join(root, 'index.html');
	if (!existsSync(indexPath)) fail('Cannot prune inline build without index.html');
	const index = readFileSync(indexPath, 'utf8');
	const staticResourcePattern =
		/\b(?:href|poster|src|srcset)\s*=\s*(["'])[^"']*_app\/(?:env\.js|immutable\/)[^"']*\1/iu;
	if (staticResourcePattern.test(index)) {
		fail('Inline build markup still loads generated _app residue');
	}
	const removed = [];
	for (const path of generatedInlineResidue) {
		const absolutePath = join(root, ...path.split('/'));
		if (!existsSync(absolutePath)) continue;
		const files = collectRegularFiles(root, absolutePath);
		for (const file of files) {
			const relativePath = normalizedRelativePath(root, file);
			removed.push({ path: relativePath, ...fileFact(file) });
		}
		rmSync(absolutePath, { recursive: true, force: true });
	}
	return {
		removedFiles: removed.length,
		removedBytes: removed.reduce((total, file) => total + file.bytes, 0),
		files: removed,
	};
}

export function verifyBlacksiteFrontendHygiene(frontendRoot, assetManifest, sourceRoot = null) {
	const root = assertPhysicalPackageDirectory(frontendRoot, 'Frontend package root');
	const files = collectRegularFiles(root);
	const actualPaths = files
		.map((path) => normalizedRelativePath(root, path))
		.sort((left, right) => left.localeCompare(right, 'en'));
	const canonicalSourceRoot = sourceRoot === null ? null : resolve(sourceRoot);
	const { compiledInline: compiledInlineAssets, external: assets } = runtimeAssetRecords(
		assetManifest,
		canonicalSourceRoot,
	);
	const expectedPaths = [
		buildIdentityPath,
		recoveryMetadataPath,
		'index.html',
		...assets.map((asset) => asset.path),
	].sort((left, right) => left.localeCompare(right, 'en'));
	if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
		fail(
			`Unexpected or missing frontend package files: expected ${JSON.stringify(expectedPaths)}, received ${JSON.stringify(actualPaths)}`,
		);
	}

	const index = readFileSync(join(root, 'index.html'), 'utf8');
	const inlineDocument = parsePinnedInlineDocument(index);
	const runtimeAssetLiterals = exactRuntimeScriptLiterals(inlineDocument.scriptProgram);
	const recoveryVersion = readRecoveryMetadata(root);
	const inlineRuntimeVersion = readInlineRuntimeVersion(inlineDocument.scriptProgram);
	if (recoveryVersion !== inlineRuntimeVersion) {
		fail(`${recoveryMetadataPath} version is not bound to the inline runtime`);
	}
	for (const asset of assets) {
		const fact = fileFact(join(root, ...asset.path.split('/')));
		if (fact.sha256 !== asset.sha256) {
			fail(`Runtime asset hash mismatch for ${asset.path}`);
		}
		if (!runtimeAssetLiterals.has(`/${asset.path}`) && !runtimeAssetLiterals.has(asset.path)) {
			fail(`Runtime asset has no exact executable package literal: ${asset.path}`);
		}
		asset.bytes = fact.bytes;
	}
	for (const asset of compiledInlineAssets) {
		for (const symbolId of asset.symbolIds) {
			if (!runtimeAssetLiterals.has(symbolId)) {
				fail(
					`${asset.id}: compiled inline SVG sprite has no exact executable symbol literal: ${symbolId}`,
				);
			}
		}
	}
	scanForbiddenContent(root, files, inlineDocument);
	return {
		result: 'PASS',
		contract: 'blacksite-inline-frontend-hygiene-v3',
		fileCount: actualPaths.length,
		totalBytes: files.reduce((total, file) => total + statSync(file).size, 0),
		runtimeAssetCount: assets.length + compiledInlineAssets.length,
		runtimeAssetPaths: assets.map((asset) => asset.path),
		runtimeAssets: [...assets, ...compiledInlineAssets],
		compiledInlineAssetCount: compiledInlineAssets.length,
		compiledInlineAssets,
		recoveryMetadata: {
			path: recoveryMetadataPath,
			version: recoveryVersion,
		},
		claims: {
			exactFileAllowlist: 'PASS',
			canonicalRuntimeAssetDigestBinding: 'PASS',
			requiredRuntimeAssetProvenanceFields: 'PASS',
			sourceAssetDigestBinding: canonicalSourceRoot ? 'PASS' : 'NOT_CHECKED',
			manifestAssetExactRuntimeScriptLiterals: 'PASS',
			embeddedDataUriScannerResult: 'NO_MATCH_IN_DECODED_VIEWS_OR_SUPPORTED_AST_PATTERNS',
			generatedRecoveryMetadataAstPatternMatch: 'PASS',
			recoveryRuntimeExecution: 'NOT_CLAIMED_BY_HYGIENE_GATE',
			highConfidenceSecretScan: 'PASS',
			debugSourceMapScannerResult: 'NO_MATCH_IN_SUPPORTED_AST_OR_TEXT_PATTERNS',
			assetRightsApproval: 'NOT_CLAIMED',
		},
	};
}
