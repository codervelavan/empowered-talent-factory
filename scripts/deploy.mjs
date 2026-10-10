// Publishes dist/ to the repo's gh-pages branch (GitHub Pages serves from it).
// Run via `npm run deploy`, which builds first.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const git = (args, cwd = '.') => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html missing: run the build first');
const remote = git(['remote', 'get-url', 'origin']);
const sha = git(['rev-parse', '--short', 'HEAD']);

// Pages runs Jekyll by default; this file turns it off so every built file is served as-is.
writeFileSync(join(dist, '.nojekyll'), '');
rmSync(join(dist, '.git'), { recursive: true, force: true });
git(['init', '-q', '-b', 'gh-pages'], dist);
git(['add', '-A'], dist);
git(['commit', '-q', '-m', `Deploy ${sha}`], dist);
git(['push', '-q', '--force', remote, 'gh-pages'], dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });
console.log(`Deployed ${sha} to gh-pages`);
