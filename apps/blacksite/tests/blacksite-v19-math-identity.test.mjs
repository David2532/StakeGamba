import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, '../../..');
const outputsRoot = resolve(repoRoot, '..');
const v18MathRoot = resolve(
	process.env.BLACKSITE_V18_MATH_ROOT?.trim() || join(outputsRoot, 'BLACKSITE_MATH_UPLOAD_V18'),
);
const v19MathRoot = resolve(
	process.env.BLACKSITE_V19_MATH_ROOT?.trim() || join(outputsRoot, 'BLACKSITE_MATH_UPLOAD_V19'),
);
const requireV19Output = process.env.BLACKSITE_REQUIRE_V19_OUTPUT === '1';

async function collectFiles(root, directory = root, files = []) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolutePath = join(directory, entry.name);
		if (entry.isDirectory()) await collectFiles(root, absolutePath, files);
		else if (entry.isFile()) files.push(relative(root, absolutePath).replaceAll('\\', '/'));
	}
	return files.sort((left, right) => left.localeCompare(right, 'en'));
}

async function treeFacts(root) {
	const files = await collectFiles(root);
	const records = [];
	const treeHash = createHash('sha256');
	for (const path of files) {
		const bytes = await readFile(join(root, path));
		const pathLength = Buffer.byteLength(path, 'utf8');
		treeHash.update(Buffer.from(`${pathLength}\0${path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		records.push({
			path,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		});
	}
	return {
		files: records,
		fileCount: records.length,
		totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
		treeSha256: treeHash.digest('hex'),
	};
}

test('the named V18 Math upload is present and remains a seven-file immutable baseline', async (t) => {
	if (!existsSync(v18MathRoot)) {
		t.skip('V18 upload evidence is external; set BLACKSITE_V18_MATH_ROOT to verify it');
		return;
	}
	assert.equal((await stat(v18MathRoot)).isDirectory(), true);
	const baseline = await treeFacts(v18MathRoot);
	assert.deepEqual(
		baseline.files.map(({ path }) => path),
		[
			'base_books.jsonl.zst',
			'base_lookup.csv',
			'blackout_books.jsonl.zst',
			'blackout_lookup.csv',
			'deep_access_books.jsonl.zst',
			'deep_access_lookup.csv',
			'index.json',
		],
	);
	assert.ok(baseline.files.every(({ bytes, sha256 }) => bytes > 0 && /^[0-9a-f]{64}$/u.test(sha256)));
});

test('V19 Math output is byte-identical to V18 when the package gate is requested', async (t) => {
	if (!existsSync(v19MathRoot)) {
		assert.equal(
			requireV19Output,
			false,
			`missing required V19 Math output: ${v19MathRoot}`,
		);
		t.skip('V19 output is verified by rerunning with BLACKSITE_REQUIRE_V19_OUTPUT=1 after packaging');
		return;
	}
	const [v18, v19] = await Promise.all([treeFacts(v18MathRoot), treeFacts(v19MathRoot)]);
	assert.deepEqual(v19.files, v18.files, 'V19 Math file list, byte sizes and SHA-256 must equal V18');
	assert.equal(v19.fileCount, v18.fileCount);
	assert.equal(v19.totalBytes, v18.totalBytes);
	assert.equal(v19.treeSha256, v18.treeSha256);
});
