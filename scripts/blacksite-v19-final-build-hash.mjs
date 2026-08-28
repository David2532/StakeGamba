import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	FRONTEND_BUILD_ROOT,
	V18_FRONTEND_TREE,
	assertV19SourceIdentity,
	createFileManifest,
	extensionCounts,
	fail,
	gitText,
	loadContract,
} from './blacksite-v19-package-contract.mjs';

function main() {
	const contract = loadContract();
	const gitSha = gitText(['rev-parse', 'HEAD']);
	assertV19SourceIdentity(gitSha);
	if (!existsSync(join(FRONTEND_BUILD_ROOT, 'index.html'))) {
		fail('Missing V19 frontend build; run pnpm --filter blacksite build first');
	}
	const frontend = createFileManifest(FRONTEND_BUILD_ROOT);
	if (frontend.treeSha256 === V18_FRONTEND_TREE) {
		fail('Observed frontend tree is unchanged from V18 and cannot be accepted as V19');
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				result: 'PASS_HASH_OBSERVATION_ONLY',
				lifecycle: contract.releaseTruth.lifecycle,
				releaseDecision: 'BLOCKED',
				uploadAuthorized: false,
				gitSha,
				frontendTreeSha256: frontend.treeSha256,
				fileCount: frontend.fileCount,
				totalBytes: frontend.totalBytes,
				extensionCounts: extensionCounts(frontend),
				nextCommand: `node scripts/blacksite-v19-package-candidate.mjs --expected-commit ${gitSha} --expected-frontend-tree ${frontend.treeSha256} --accept-final-build-tree`,
				note:
					'This read-only hash observation is not a package, visual approval, upload authorization or release decision.',
			},
			null,
			2,
		)}\n`,
	);
}

try {
	main();
} catch (error) {
	console.error(error.stack || error);
	process.exitCode = 1;
}
