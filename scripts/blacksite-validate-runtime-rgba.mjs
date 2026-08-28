#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const TREE_HASH_ALGORITHM =
	'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)';
const LOCAL_ASSET_PATH_PATTERN = /\.webp$/iu;
const AUTHORING_TOP_LEVEL_FIELDS = Object.freeze(['pink_background', 'concept_keyframes']);
const AUTHORING_ANIMATED_FIELDS = Object.freeze([
	'pink_frames',
	'preview_webp',
	'preview_gif',
	'contact_sheet',
]);

export class RuntimeRgbaValidationError extends Error {
	constructor(errors) {
		super(`BLACKSITE Runtime RGBA validation failed with ${errors.length} error(s)`);
		this.name = 'RuntimeRgbaValidationError';
		this.errors = errors;
	}
}

function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

function isInside(root, target) {
	const pathFromRoot = relative(root, target);
	return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function assertSafeRelativePath(path, label, errors) {
	if (typeof path !== 'string' || path.length === 0) {
		errors.push(`${label}: path must be a non-empty string`);
		return false;
	}
	if (path.includes('\\') || path.startsWith('/') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
		errors.push(`${label}: unsafe/non-canonical relative path ${JSON.stringify(path)}`);
		return false;
	}
	return true;
}

function uint24le(bytes, offset) {
	return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function inspectWebp(bytes, label, expectedSize, errors) {
	if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes ?? []);
	if (!Array.isArray(errors)) throw new TypeError('errors must be an array');
	if (
		bytes.length < 20 ||
		bytes.toString('ascii', 0, 4) !== 'RIFF' ||
		bytes.toString('ascii', 8, 12) !== 'WEBP'
	) {
		errors.push(`${label}: not a WebP RIFF asset`);
		return null;
	}
	if (bytes.readUInt32LE(4) + 8 !== bytes.length) {
		errors.push(`${label}: RIFF byte length does not match the file`);
	}

	let offset = 12;
	let width = null;
	let height = null;
	let hasAlpha = false;
	let imageChunk = null;
	while (offset + 8 <= bytes.length) {
		const chunk = bytes.toString('ascii', offset, offset + 4);
		const length = bytes.readUInt32LE(offset + 4);
		const dataOffset = offset + 8;
		const end = dataOffset + length;
		if (end > bytes.length) {
			errors.push(`${label}: ${chunk} chunk exceeds the RIFF boundary`);
			return null;
		}
		if (chunk === 'VP8X') {
			if (length < 10) {
				errors.push(`${label}: VP8X chunk is shorter than ten bytes`);
				return null;
			}
			imageChunk ??= chunk;
			hasAlpha ||= (bytes[dataOffset] & 0x10) !== 0;
			width = uint24le(bytes, dataOffset + 4) + 1;
			height = uint24le(bytes, dataOffset + 7) + 1;
		} else if (chunk === 'ALPH') {
			hasAlpha = true;
		} else if (chunk === 'VP8 ') {
			imageChunk ??= chunk;
			if (length < 10 || !bytes.subarray(dataOffset + 3, dataOffset + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
				errors.push(`${label}: VP8 frame header is invalid`);
				return null;
			}
			width ??= bytes.readUInt16LE(dataOffset + 6) & 0x3fff;
			height ??= bytes.readUInt16LE(dataOffset + 8) & 0x3fff;
		} else if (chunk === 'VP8L') {
			imageChunk ??= chunk;
			if (length < 5 || bytes[dataOffset] !== 0x2f) {
				errors.push(`${label}: VP8L frame header is invalid`);
				return null;
			}
			const bits = bytes.readUInt32LE(dataOffset + 1);
			width ??= (bits & 0x3fff) + 1;
			height ??= ((bits >>> 14) & 0x3fff) + 1;
			hasAlpha ||= ((bits >>> 28) & 1) === 1;
		}
		offset = end + (length & 1);
	}
	if (!imageChunk || width === null || height === null) {
		errors.push(`${label}: WebP image dimensions are unavailable`);
		return null;
	}
	const metadata = { format: 'webp', width, height, has_alpha: hasAlpha };
	if (width !== expectedSize.width || height !== expectedSize.height) {
		errors.push(`${label}: WebP is ${width}x${height}; expected ${expectedSize.width}x${expectedSize.height}`);
	}
	if (!hasAlpha) errors.push(`${label}: WebP must retain an alpha channel`);
	return metadata;
}

function validSize(size, label, errors) {
	if (!size || !Number.isInteger(size.width) || size.width <= 0 || !Number.isInteger(size.height) || size.height <= 0) {
		errors.push(`${label}: declared frame size must contain positive integer width/height`);
		return false;
	}
	return true;
}

function collectLocalAssetReferences(value, label = 'manifest', references = []) {
	if (typeof value === 'string') {
		if (LOCAL_ASSET_PATH_PATTERN.test(value)) references.push({ label, path: value });
		return references;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => collectLocalAssetReferences(entry, `${label}[${index}]`, references));
		return references;
	}
	if (!value || typeof value !== 'object') return references;
	for (const [key, entry] of Object.entries(value)) {
		collectLocalAssetReferences(entry, `${label}.${key}`, references);
	}
	return references;
}

function validateDeployManifestShape(manifest, descriptors, errors) {
	for (const field of AUTHORING_TOP_LEVEL_FIELDS) {
		if (Object.hasOwn(manifest, field)) errors.push(`manifest.${field}: authoring-only field is not allowed in the deployed manifest`);
	}
	for (const sectionName of ['runtime_sequences', 'standalone_fx']) {
		const section = manifest[sectionName];
		if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
		for (const [entryId, entry] of Object.entries(section)) {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
			for (const field of AUTHORING_ANIMATED_FIELDS) {
				if (Object.hasOwn(entry, field)) {
					errors.push(`${sectionName}.${entryId}.${field}: authoring-only field is not allowed in the deployed manifest`);
				}
			}
		}
	}
	const staticKeyposes = manifest.static_keyposes;
	if (staticKeyposes && typeof staticKeyposes === 'object' && !Array.isArray(staticKeyposes)) {
		for (const [poseId, pose] of Object.entries(staticKeyposes)) {
			if (pose && typeof pose === 'object' && !Array.isArray(pose) && Object.hasOwn(pose, 'pink')) {
				errors.push(`static_keyposes.${poseId}.pink: authoring-only field is not allowed in the deployed manifest`);
			}
		}
	}

	const productionPaths = new Set(descriptors.map(({ path }) => path));
	for (const reference of collectLocalAssetReferences(manifest)) {
		if (!productionPaths.has(reference.path)) {
			errors.push(`${reference.label}: local asset reference is not a declared shipped RGBA asset (${reference.path})`);
		}
	}
}

function collectAnimatedDescriptors(manifest, sectionName, descriptors, expectedByDirectory, errors) {
	const section = manifest[sectionName];
	if (!section || typeof section !== 'object' || Array.isArray(section)) {
		errors.push(`${sectionName}: required object is missing`);
		return;
	}
	for (const [sequenceId, sequence] of Object.entries(section)) {
		const label = `${sectionName}.${sequenceId}`;
		if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) {
			errors.push(`${label}: sequence contract must be an object`);
			continue;
		}
		if (sequence.name !== sequenceId) errors.push(`${label}: name must exactly equal ${sequenceId}`);
		if (!Array.isArray(sequence.frames)) {
			errors.push(`${label}: frames must be an array`);
			continue;
		}
		if (!Number.isInteger(sequence.frame_count) || sequence.frame_count !== sequence.frames.length) {
			errors.push(`${label}: frame_count ${JSON.stringify(sequence.frame_count)} does not match frames.length ${sequence.frames.length}`);
		}
		if (!validSize(sequence.frame_size, `${label}.frame_size`, errors)) continue;
		const directory = `${sectionName}/${sequenceId}/rgba`;
		const expectedNames = new Set();
		sequence.frames.forEach((framePath, index) => {
			const expectedIndex = String(index).padStart(3, '0');
			const expectedPath = `${directory}/${sequenceId}_${expectedIndex}.webp`;
			if (!assertSafeRelativePath(framePath, `${label}.frames[${index}]`, errors)) return;
			if (framePath !== expectedPath) {
				errors.push(`${label}.frames[${index}]: expected ${expectedPath}, received ${framePath}`);
			}
			if (!framePath.includes('/rgba/')) {
				errors.push(`${label}.frames[${index}]: runtime paths must come only from an rgba directory`);
			}
			expectedNames.add(`${sequenceId}_${expectedIndex}.webp`);
			descriptors.push({
				group: sectionName,
				sequence: sequenceId,
				path: framePath,
				size: sequence.frame_size,
			});
		});
		expectedByDirectory.set(directory, expectedNames);
	}
}

function collectStaticDescriptors(manifest, descriptors, expectedByDirectory, errors) {
	const section = manifest.static_keyposes;
	if (!section || typeof section !== 'object' || Array.isArray(section)) {
		errors.push('static_keyposes: required object is missing');
		return;
	}
	const directory = 'static_keyposes/rgba';
	const expectedNames = new Set();
	for (const [poseId, pose] of Object.entries(section)) {
		const label = `static_keyposes.${poseId}`;
		if (!pose || typeof pose !== 'object' || Array.isArray(pose)) {
			errors.push(`${label}: keypose contract must be an object`);
			continue;
		}
		if (!validSize(pose.size, `${label}.size`, errors)) continue;
		const expectedPath = `${directory}/${poseId}.webp`;
		if (!assertSafeRelativePath(pose.rgba, `${label}.rgba`, errors)) continue;
		if (pose.rgba !== expectedPath) errors.push(`${label}.rgba: expected ${expectedPath}, received ${pose.rgba}`);
		if (!pose.rgba.includes('/rgba/')) errors.push(`${label}.rgba: runtime paths must come only from an rgba directory`);
		expectedNames.add(`${poseId}.webp`);
		descriptors.push({ group: 'static_keyposes', sequence: poseId, path: pose.rgba, size: pose.size });
	}
	expectedByDirectory.set(directory, expectedNames);
}

async function validateExactDirectories(sourceRoot, expectedByDirectory, errors) {
	for (const [relativeDirectory, expectedNames] of expectedByDirectory) {
		const directory = resolve(sourceRoot, ...relativeDirectory.split('/'));
		try {
			const entries = await readdir(directory, { withFileTypes: true });
			const actualNames = entries.map(({ name }) => name).sort();
			const expected = [...expectedNames].sort();
			for (const missing of expected.filter((name) => !actualNames.includes(name))) {
				errors.push(`${relativeDirectory}: missing expected runtime file ${missing}`);
			}
			for (const unexpected of actualNames.filter((name) => !expectedNames.has(name))) {
				errors.push(`${relativeDirectory}: unexpected runtime entry ${unexpected}`);
			}
		} catch (error) {
			errors.push(`${relativeDirectory}: cannot read rgba directory (${error.code ?? error.message})`);
		}
	}
}

export async function validateRuntimeRgbaPackage({ root, manifest: manifestFile }) {
	if (!root || !manifestFile) throw new TypeError('root and manifest are required');
	const sourceRoot = resolve(root);
	const manifestPath = resolve(manifestFile);
	const errors = [];

	const rootStat = await stat(sourceRoot).catch(() => null);
	if (!rootStat?.isDirectory()) throw new RuntimeRgbaValidationError([`source root is not a readable directory: ${sourceRoot}`]);
	const canonicalRoot = await realpath(sourceRoot);
	const manifestBytes = await readFile(manifestPath).catch(() => null);
	if (!manifestBytes) throw new RuntimeRgbaValidationError([`manifest is not readable: ${manifestPath}`]);
	let manifest;
	try {
		manifest = JSON.parse(manifestBytes.toString('utf8'));
	} catch (error) {
		throw new RuntimeRgbaValidationError([`manifest is not valid JSON: ${error.message}`]);
	}

	const descriptors = [];
	const expectedByDirectory = new Map();
	collectAnimatedDescriptors(manifest, 'runtime_sequences', descriptors, expectedByDirectory, errors);
	collectAnimatedDescriptors(manifest, 'standalone_fx', descriptors, expectedByDirectory, errors);
	collectStaticDescriptors(manifest, descriptors, expectedByDirectory, errors);
	validateDeployManifestShape(manifest, descriptors, errors);
	const duplicatePaths = descriptors.map(({ path }) => path).filter((path, index, paths) => paths.indexOf(path) !== index);
	for (const duplicate of new Set(duplicatePaths)) errors.push(`manifest runtime path is duplicated: ${duplicate}`);
	await validateExactDirectories(sourceRoot, expectedByDirectory, errors);

	const records = [];
	for (const descriptor of [...descriptors].sort((a, b) => a.path.localeCompare(b.path))) {
		const absolutePath = resolve(sourceRoot, ...descriptor.path.split('/'));
		let bytes;
		try {
			const canonicalFile = await realpath(absolutePath);
			if (!isInside(canonicalRoot, canonicalFile)) {
				errors.push(`${descriptor.path}: resolves outside the supplied source root`);
				continue;
			}
			bytes = await readFile(canonicalFile);
		} catch (error) {
			errors.push(`${descriptor.path}: cannot read expected frame (${error.code ?? error.message})`);
			continue;
		}
			const metadata = inspectWebp(bytes, descriptor.path, descriptor.size, errors);
		records.push({ ...descriptor, bytes: bytes.length, sha256: sha256(bytes), metadata, raw: bytes });
	}

	if (errors.length > 0) throw new RuntimeRgbaValidationError(errors);
	const treeHash = createHash('sha256');
	for (const record of records) {
		treeHash.update(Buffer.from(`${Buffer.byteLength(record.path, 'utf8')}\0${record.path}\0${record.bytes}\0`, 'utf8'));
		treeHash.update(record.raw);
	}
	const sequenceHashes = {};
	for (const sequenceId of [...new Set(records.map(({ sequence }) => sequence))].sort()) {
		const digest = createHash('sha256');
		for (const record of records.filter(({ sequence }) => sequence === sequenceId)) {
			digest.update(`${record.path}\0${record.sha256}\n`);
		}
		sequenceHashes[sequenceId] = digest.digest('hex');
	}
	const animatedRecords = records.filter(({ group }) => group !== 'static_keyposes');
	const report = {
		ok: true,
		package: manifest.package ?? null,
		version: manifest.version ?? null,
		source_root: canonicalRoot,
		manifest_path: manifestPath,
		totals: {
			runtime_sequences: Object.keys(manifest.runtime_sequences).length,
			standalone_fx: Object.keys(manifest.standalone_fx).length,
			animated_frames: animatedRecords.length,
			static_keyposes: records.length - animatedRecords.length,
			runtime_webps: records.length,
			bytes: records.reduce((sum, record) => sum + record.bytes, 0),
		},
		hashes: {
			manifest_sha256: sha256(manifestBytes),
			runtime_tree_sha256: treeHash.digest('hex'),
			runtime_tree_algorithm: TREE_HASH_ALGORITHM,
			sequences: sequenceHashes,
		},
		files: records.map(({ raw: _raw, ...record }) => record),
	};
	return report;
}

function parseArgs(argv) {
	const options = { json: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--root' || argument === '--manifest') {
			const value = argv[index + 1];
			if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
			options[argument.slice(2)] = value;
			index += 1;
		} else if (argument === '--json') options.json = true;
		else if (argument === '--help' || argument === '-h') options.help = true;
		else throw new Error(`unknown argument: ${argument}`);
	}
	return options;
}

function usage() {
	return [
		'Usage:',
		'  node scripts/blacksite-validate-runtime-rgba.mjs --root <asset-package-root> --manifest <manifest.json> [--json]',
		'',
		'The validator is read-only. --json includes SHA-256 for every accepted runtime WebP.',
	].join('\n');
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		console.error(usage());
		process.exitCode = 2;
		return;
	}
	if (options.help) {
		console.log(usage());
		return;
	}
	if (!options.root || !options.manifest) {
		console.error(usage());
		process.exitCode = 2;
		return;
	}
	try {
		const report = await validateRuntimeRgbaPackage(options);
		if (options.json) console.log(JSON.stringify(report, null, 2));
		else {
			console.log('BLACKSITE Runtime RGBA validation: PASS');
			console.log(`Runtime WebPs: ${report.totals.runtime_webps} (${report.totals.bytes} bytes)`);
			console.log(`Animated frames: ${report.totals.animated_frames}; static keyposes: ${report.totals.static_keyposes}`);
			console.log(`Manifest SHA-256: ${report.hashes.manifest_sha256}`);
			console.log(`Runtime tree SHA-256: ${report.hashes.runtime_tree_sha256}`);
			for (const [sequence, digest] of Object.entries(report.hashes.sequences)) console.log(`${sequence}: ${digest}`);
		}
	} catch (error) {
		if (error instanceof RuntimeRgbaValidationError) {
			console.error(`BLACKSITE Runtime RGBA validation: FAIL (${error.errors.length} error(s))`);
			for (const detail of error.errors) console.error(`- ${detail}`);
			process.exitCode = 1;
			return;
		}
		throw error;
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
