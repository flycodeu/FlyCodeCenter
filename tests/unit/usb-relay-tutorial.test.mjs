import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import matter from 'gray-matter';

const root = new URL('../../', import.meta.url);
const article = matter(await readFile(new URL('src/content/blog/USB单路继电器零基础入门与Python实操.md', root), 'utf8'));
const examples = new URL('public/examples/usb-relay/', root);
const normalize = value => value.replaceAll('\r\n', '\n').trimEnd();

test('USB relay article keeps its route and exact downloadable teaching code', async () => {
  assert.equal(article.data.code, 'b2kz8iy4i');
  assert.equal(article.data.permalink, '/blog/b2kz8iy4i/');
  const blocks = [...article.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const complete = blocks.filter(block => block[1].includes('def check_target(port)'));
  assert.equal(complete.length, 1);
  assert.equal(normalize(complete[0][1]), normalize(await readFile(new URL('relay_control.py', examples), 'utf8')));
});

test('USB relay downloads contain only the four intended source files', async () => {
  const names = ['README.md', 'relay_control.py', 'requirements.txt', 'test_relay_control.py'];
  assert.deepEqual((await readdir(fileURLToPath(examples))).sort(), names.sort());
  const linked = new Set([...article.content.matchAll(/\]\(\/examples\/usb-relay\/([^/)]+)\)/g)].map(match => match[1]));
  assert.deepEqual([...linked].sort(), names.sort());
  for (const name of names) assert.ok((await readFile(new URL(name, examples), 'utf8')).length > 0);
  assert.equal((await readFile(new URL('requirements.txt', examples), 'utf8')).trim(), 'pyserial==3.5');
});

test('USB relay article retains unverified hardware and no-load boundaries', () => {
  assert.match(article.content, /实体动作及触点通断仍待确认/);
  assert.match(article.content, /没有万用表实测证据/);
  assert.match(article.content, /没有为写作而再次驱动实体板卡/);
  assert.match(article.content, /不要带着外部接线虚假填写 `--confirm-no-load`/);
  assert.match(article.content, /不是把使用者原脚本直接改名/);
  assert.match(article.content, /不能把元件资料当成整板说明书/);
});
