import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const task = String(process.argv[2] || '').trim();

if (!/^[a-zA-Z0-9:_-]+$/.test(task)) {
	console.error('Usage: node scripts/run-workspace-task.mjs <task>');
	process.exit(2);
}

const defaultTimeout = task === 'build' ? 20 * 60_000 : 10 * 60_000;
const configuredTimeout = Number(process.env.WORKSPACE_TASK_TIMEOUT_MS || defaultTimeout);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
	? Math.floor(configuredTimeout)
	: defaultTimeout;

const pnpmArgs = [
	'--recursive',
	'--sort',
	'--workspace-concurrency=1',
	'--if-present',
	'run',
	task,
];

const env = {
	...process.env,
	CI: process.env.CI || '1',
};

// This repository still uses legacy .eslintrc.cjs files. ESLint 9 requires
// the compatibility switch until the shared config is migrated to flat config.
if (task === 'lint') env.ESLINT_USE_FLAT_CONFIG = 'false';

const isWindows = process.platform === 'win32';
// pnpm.cmd is a Windows command script and cannot be executed directly by
// child_process.spawn() on current Node.js versions. Invoke it through the
// configured command processor instead of enabling spawn's shell option.
const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'pnpm';
const commandArgs = isWindows
	? ['/d', '/c', 'pnpm.cmd', ...pnpmArgs]
	: pnpmArgs;
const displayCommand = isWindows
	? `pnpm.cmd ${pnpmArgs.join(' ')}`
	: `pnpm ${pnpmArgs.join(' ')}`;

console.log(`[workspace:${task}] ${displayCommand}`);
console.log(`[workspace:${task}] timeout=${timeoutMs}ms`);

const child = spawn(command, commandArgs, {
	cwd: root,
	env,
	stdio: 'inherit',
	detached: !isWindows,
	shell: false,
	windowsHide: true,
});

let finished = false;

function killTree() {
	if (!child.pid) return;
	if (isWindows) {
		spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true,
		});
		return;
	}
	try {
		process.kill(-child.pid, 'SIGTERM');
	} catch {
		try { child.kill('SIGTERM'); } catch { /* already exited */ }
	}
}

const timer = setTimeout(() => {
	if (finished) return;
	console.error(`[workspace:${task}] timed out after ${timeoutMs}ms`);
	killTree();
	setTimeout(() => process.exit(124), 250).unref();
}, timeoutMs);

timer.unref();

child.on('error', (error) => {
	finished = true;
	clearTimeout(timer);
	console.error(`[workspace:${task}] failed to start: ${error.message}`);
	process.exit(1);
});

child.on('exit', (code, signal) => {
	finished = true;
	clearTimeout(timer);
	if (signal) {
		console.error(`[workspace:${task}] terminated by signal ${signal}`);
		process.exit(1);
	}
	process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		if (!finished) killTree();
		process.exit(130);
	});
}
