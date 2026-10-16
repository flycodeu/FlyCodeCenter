import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import matter from 'gray-matter';

const root = fileURLToPath(new URL('../../', import.meta.url));
const contentDir = path.join(root, 'src/content/tutorial/face-recognition');
const examplesDir = path.join(root, 'public/examples/face-recognition');
const pages = await Promise.all((await readdir(contentDir)).filter(name => name.endsWith('.md')).map(async name => {
  const raw = await readFile(path.join(contentDir, name), 'utf8');
  return { name, ...matter(raw) };
}));

test('five face tutorial pages keep stable routes and complete navigation', () => {
  assert.equal(pages.length, 5);
  assert.equal(new Set(pages.map(page => page.data.code)).size, 5);
  const routes = new Set(pages.map(page => page.data.permalink));
  assert.ok(routes.has('/tutorials/face-recognition/'));
  for (const page of pages) {
    assert.ok(page.content.length > 1000, page.name);
    for (const link of page.content.matchAll(/\]\((\/tutorials\/[^)#]+)\)/g)) {
      assert.ok(routes.has(link[1]), `${page.name}: unknown tutorial link ${link[1]}`);
    }
  }
});

test('all linked example downloads exist and no models or photos are published', async () => {
  const allowed = new Set(['algorithms.py', 'test_algorithms.py', 'test_image_pipeline.py', 'face_io.py', 'single_image_pad.py', 'landmark_camera.py', 'compare_faces.py', 'pnp_pose.py', 'README.md']);
  const files = await readdir(examplesDir);
  assert.deepEqual(new Set(files), allowed);
  for (const page of pages) {
    for (const link of page.content.matchAll(/\]\(\/examples\/face-recognition\/([^/)]+)\)/g)) {
      assert.ok(allowed.has(link[1]), `${page.name}: missing example ${link[1]}`);
      assert.ok((await readFile(path.join(examplesDir, link[1]), 'utf8')).length > 0);
    }
  }
});

test('tutorials focus on image algorithms and keep pose separate from single-image PAD', async () => {
  const algorithms = await readFile(path.join(examplesDir, 'algorithms.py'), 'utf8');
  assert.match(algorithms, /no PAD or identity verification/);
  const guide = pages.find(page => page.data.code === 'tface-engineering');
  assert.match(guide.content, /single_image_pad\.py/);
  assert.match(guide.content, /不需要两张图片，也不采集转头过程/);
  assert.match(pages.find(page => page.data.code === 'tface-pad').content, /不需要先看到转头或眨眼/);
  assert.match(pages.find(page => page.data.code === 'tface-actions').content, /需要连续图像/);
  for (const page of pages) {
    assert.ok(page.data.title.length <= 8, page.data.title);
    assert.doesNotMatch(page.content, /Java|Vue|8092|协议版本|LRU|任务有效|结果交付/);
  }
});
