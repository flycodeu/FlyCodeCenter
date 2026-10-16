import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathIssue, inspectPublic, checkRepository } from '../../scripts/check-repo.mjs';

test('rejects generated files and local environment files without banning source downloads', () => {
  for (const filename of ['dist/client/index.html', '.tmp-build-guide/verify.mjs', 'demo/target/classes/A.class',
    '.env', '.env.production', 'example/.env.local', 'a/__pycache__/x.pyc', 'public/model.onnx',
    'public/models/a.pth', 'playwright-report/index.html', 'a\\.venv\\pyvenv.cfg']) {
    assert.ok(pathIssue(filename), filename);
  }
  for (const filename of ['.env.example', '.env.production.example', '.gitignore', 'docs/config.md',
    'public/examples/login-encryption.zip', 'public/examples/face-recognition/algorithms.py',
    'public/search/minisearch.json', 'public/encrypted/manifest.json', 'public/fonts/pixel/zpix.woff2']) {
    assert.equal(pathIssue(filename), null, filename);
  }
});

test('public inspection catches ignored artifacts and empty generated directories', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flycode-repo-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'public/examples/demo/target'), { recursive: true });
  await writeFile(path.join(root, 'public/.env.local'), 'DEMO=value');
  await writeFile(path.join(root, 'public/example.py'), '# example');
  const issues = await inspectPublic(root);
  assert.equal(issues.length, 2);
  assert.ok(issues.some(issue => issue.startsWith('public/examples/demo/target:')));
  assert.ok(issues.some(issue => issue.startsWith('public/.env.local:')));
});

test('repository check includes tracked ignored files as well as new files', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flycode-git-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet', root]);
  await writeFile(path.join(root, '.gitignore'), '.env.local\n');
  await writeFile(path.join(root, '.env.local'), 'DEMO=value');
  execFileSync('git', ['add', '-f', '.env.local'], { cwd: root });
  await mkdir(path.join(root, 'target'));
  await writeFile(path.join(root, 'target/compiled.class'), 'test');
  const issues = await checkRepository(root);
  assert.equal(issues.length, 2);
  assert.ok(issues.some(issue => issue.startsWith('.env.local:')));
  assert.ok(issues.some(issue => issue.startsWith('target/compiled.class:')));
});
