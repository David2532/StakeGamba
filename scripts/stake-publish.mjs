import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const publish = join(root, 'publish');
const frontend = join(publish, 'frontend');
const math = join(publish, 'math');
const cluster = join(root, 'apps', 'cluster');
const gameRoot = join(root, 'math', 'games', 'golden_goal_rush');
const mathLibrary = join(gameRoot, 'library');

function reset(path) {
	rmSync(path, { recursive: true, force: true });
	mkdirSync(path, { recursive: true });
}

function copy(source, destination) {
	if (!existsSync(source)) throw new Error(`Missing publish source: ${source}`);
	cpSync(source, destination, { recursive: true, force: true });
}

reset(frontend);
copy(join(cluster, 'preview.html'), join(frontend, 'index.html'));
copy(join(cluster, 'static'), frontend);
mkdirSync(join(frontend, 'src', 'assets'), { recursive: true });
copy(join(cluster, 'src', 'assets', 'golden-goal-rush'), join(frontend, 'src', 'assets', 'golden-goal-rush'));
rmSync(join(frontend, 'assets', 'fonts'), { recursive: true, force: true });

reset(math);
const publishIndexPath = join(mathLibrary, 'publish_files', 'index.json');
const publishIndex = JSON.parse(readFileSync(publishIndexPath, 'utf8'));
for (const name of ['index.json', 'README_UPLOAD.txt', 'UPLOAD_GUIDE.txt', 'RTP_AUDIT.json', 'RTP_AUDIT.txt']) {
	copy(join(mathLibrary, 'publish_files', name), join(math, name));
}
copy(join(mathLibrary, 'configs', 'game_config.json'), join(math, 'game_config.json'));
for (const mode of publishIndex.modes) {
	copy(join(mathLibrary, 'lookup_tables', mode.weights), join(math, mode.weights));
	copy(join(mathLibrary, 'books_compressed', mode.events), join(math, mode.events));
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const hashes = {
	frontend: sha256(join(frontend, 'index.html')),
	mathConfig: sha256(join(math, 'game_config.json')),
	mathIndex: sha256(join(math, 'index.json')),
};
writeFileSync(join(publish, 'publish-hashes.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), ...hashes }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', frontend, math, hashes }, null, 2));
