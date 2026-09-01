import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, '..');
const repoRoot = resolve(appRoot, '..', '..');
const buildRoot = join(appRoot, 'build');

function gitText(args) {
	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

const gitSha = gitText(['rev-parse', 'HEAD']);
const gitTreeSha = gitText(['rev-parse', 'HEAD^{tree}']);
const gitStatus = gitText(['status', '--porcelain=v1', '--untracked-files=all']);

rmSync(buildRoot, { recursive: true, force: true });

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
execFileSync(pnpmCommand, ['exec', 'vite', 'build'], {
	cwd: appRoot,
	stdio: 'inherit',
});

if (!existsSync(join(buildRoot, 'index.html'))) {
	throw new Error('BLACKSITE production build did not create build/index.html');
}

const identityRoot = join(buildRoot, '_app');
mkdirSync(identityRoot, { recursive: true });
writeFileSync(
	join(identityRoot, 'blacksite-build-identity.json'),
	`${JSON.stringify(
		{
			schema: 'blacksite-frontend-build-identity-v1',
			gitSha,
			gitTreeSha,
			clean: gitStatus === '',
		},
		null,
		2,
	)}\n`,
);
