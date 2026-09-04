import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-ignore -- shared workspace config is JavaScript by design.
import config from 'config-svelte';

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, '..', '..');
const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
	cwd: repoRoot,
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const expectedGitSha = process.env.BLACKSITE_BUILD_GIT_SHA;

if (!/^[0-9a-f]{40}$/u.test(gitSha)) {
	throw new Error(`BLACKSITE requires a full lowercase Git SHA for its build version: ${gitSha}`);
}
if (expectedGitSha !== undefined && expectedGitSha !== gitSha) {
	throw new Error(
		`BLACKSITE build-version checkout mismatch: expected ${expectedGitSha}, actual ${gitSha}`,
	);
}

// @ts-ignore -- the shared package exports a factory, but its package boundary exposes Config.
const sharedConfig = config();

export default {
	...sharedConfig,
	kit: {
		...sharedConfig.kit,
		version: {
			...sharedConfig.kit?.version,
			name: gitSha,
		},
	},
};
