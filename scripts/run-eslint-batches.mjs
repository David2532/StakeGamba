import { readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workingDirectory = process.cwd();
const target = resolve(workingDirectory, process.argv[2] || 'src');
const configuredBatchSize = Number(process.env.ESLINT_BATCH_SIZE || 20);
const batchSize = Number.isInteger(configuredBatchSize) && configuredBatchSize > 0
	? configuredBatchSize
	: 20;
const supportedExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.svelte']);
const ignoredDirectories = new Set(['node_modules', '.svelte-kit', 'dist', 'build', 'coverage']);

function extensionOf(path) {
	const match = path.match(/(\.[^.\\/]+)$/);
	return match ? match[1].toLowerCase() : '';
}

function collectFiles(directory) {
	const files = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				files.push(...collectFiles(resolve(directory, entry.name)));
			}
			continue;
		}
		if (entry.isFile() && supportedExtensions.has(extensionOf(entry.name))) {
			files.push(resolve(directory, entry.name));
		}
	}
	return files;
}

const files = collectFiles(target)
	.map((path) => relative(workingDirectory, path).replaceAll('\\', '/'))
	.sort();

if (!files.length) {
	console.log(`[eslint-batches] no lintable files under ${target}`);
	process.exit(0);
}

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'pnpm';
let failed = false;

for (let offset = 0; offset < files.length; offset += batchSize) {
	const batch = files.slice(offset, offset + batchSize);
	const pnpmArgs = ['exec', 'eslint', '--no-error-on-unmatched-pattern', ...batch];
	const args = isWindows ? ['/d', '/c', 'pnpm.cmd', ...pnpmArgs] : pnpmArgs;
	const number = Math.floor(offset / batchSize) + 1;
	const total = Math.ceil(files.length / batchSize);
	console.log(`[eslint-batches] batch ${number}/${total} (${batch.length} files)`);
	const result = spawnSync(command, args, {
		cwd: workingDirectory,
		env: process.env,
		stdio: 'inherit',
		shell: false,
		windowsHide: true,
	});
	if (result.error) {
		console.error(`[eslint-batches] failed to start batch ${number}: ${result.error.message}`);
		failed = true;
		continue;
	}
	if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
