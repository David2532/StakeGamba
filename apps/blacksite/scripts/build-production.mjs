import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pruneBlacksiteInlineBuildResidue } from '../../../scripts/blacksite-frontend-hygiene.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDirectory, '..');
const repoRoot = resolve(appRoot, '..', '..');
const buildRoot = join(appRoot, 'build');
const requireFromApp = createRequire(join(appRoot, 'package.json'));

function resolveViteCli() {
	const packagePath = requireFromApp.resolve('vite/package.json');
	const packageManifest = JSON.parse(readFileSync(packagePath, 'utf8'));
	if (typeof packageManifest.bin?.vite !== 'string' || packageManifest.bin.vite.length === 0) {
		throw new Error('The installed Vite package does not expose its CLI entry point');
	}
	return resolve(dirname(packagePath), packageManifest.bin.vite);
}

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

execFileSync(process.execPath, [resolveViteCli(), 'build'], {
	cwd: appRoot,
	env: { ...process.env, BLACKSITE_BUILD_GIT_SHA: gitSha },
	stdio: 'inherit',
});

if (!existsSync(join(buildRoot, 'index.html'))) {
	throw new Error('BLACKSITE production build did not create build/index.html');
}

const recoveryMetadataPath = join(buildRoot, '_app', 'version.json');
let recoveryMetadata;
try {
	recoveryMetadata = JSON.parse(readFileSync(recoveryMetadataPath, 'utf8'));
} catch (error) {
	throw new Error(`BLACKSITE production build has invalid recovery metadata: ${error.message}`);
}
if (
	JSON.stringify(Object.keys(recoveryMetadata)) !== JSON.stringify(['version']) ||
	recoveryMetadata.version !== gitSha
) {
	throw new Error('BLACKSITE production build version must equal the exact Git SHA');
}

const pruned = pruneBlacksiteInlineBuildResidue(buildRoot);
process.stdout.write(
	`BLACKSITE inline package pruned ${pruned.removedFiles} generated external-residue files / ${pruned.removedBytes} bytes\n`,
);

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
