import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = readFileSync(0, 'utf8');
const opensPullRequest =
  /\bgh(?:\.exe)?\s+pr\s+create\b/.test(input) || /\bgh(?:\.exe)?\s+api\b[^\n]*\/pulls\b[^\n]*\bPOST\b/.test(input);

if (!opensPullRequest) process.exit(0);

const result = spawnSync('npm run check', {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  encoding: 'utf8',
  shell: true,
});

if (result.status !== 0) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-4000);
  console.error(`PR bloqueado: npm run check falhou.\n${output}`);
  process.exit(2);
}
