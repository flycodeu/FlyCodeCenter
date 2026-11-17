import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import matter from 'gray-matter';
import { buildLessonSteps, evaluateWeight } from '../../src/plugins/runtime/article/param-learning-model.js';

const root = new URL('../../', import.meta.url);
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('double dataset evaluates candidate errors [6, 0, 6, 12], picks weight 2, and predicts 8', () => {
  const { dataset, steps } = buildLessonSteps('double');
  assert.equal(steps.length, 10);
  assert.equal(steps[0].kind, 'init');
  assert.equal(steps[0].bestWeight, null);
  assert.equal(steps[0].bestError, null);

  const evaluations = dataset.candidates.map((w) => evaluateWeight(dataset.samples, w).totalError);
  assert.deepEqual(evaluations, [6, 0, 6, 12]);

  const compareSteps = steps.filter((step) => step.kind === 'compare');
  assert.deepEqual(
    compareSteps.map((step) => ({ w: step.activeWeight, bestW: step.bestWeight, improved: step.improved })),
    [
      { w: 1, bestW: 1, improved: true },
      { w: 2, bestW: 2, improved: true },
      { w: 3, bestW: 2, improved: false },
      { w: 4, bestW: 2, improved: false }
    ]
  );

  const last = steps.at(-1);
  assert.equal(last.kind, 'predict');
  assert.equal(last.bestWeight, 2);
  assert.deepEqual(last.prediction, { x: 4, y: 8 });
});

test('triple dataset evaluates candidate errors [12, 6, 0, 6], picks weight 3, and predicts 12', () => {
  const { dataset, steps } = buildLessonSteps('triple');
  assert.equal(steps.length, 10);

  const evaluations = dataset.candidates.map((w) => evaluateWeight(dataset.samples, w).totalError);
  assert.deepEqual(evaluations, [12, 6, 0, 6]);

  const compareSteps = steps.filter((step) => step.kind === 'compare');
  assert.deepEqual(
    compareSteps.map((step) => ({ w: step.activeWeight, bestW: step.bestWeight, improved: step.improved })),
    [
      { w: 1, bestW: 1, improved: true },
      { w: 2, bestW: 2, improved: true },
      { w: 3, bestW: 3, improved: true },
      { w: 4, bestW: 3, improved: false }
    ]
  );

  const last = steps.at(-1);
  assert.equal(last.bestWeight, 3);
  assert.deepEqual(last.prediction, { x: 4, y: 12 });
});

test('unknown dataset throws RangeError', () => {
  assert.throws(() => buildLessonSteps('unknown'), RangeError);
});

test('agent tutorial files keep valid links and match lesson01.py', async () => {
  const readme = matter(await readFile(new URL('src/content/tutorial/agent/README.md', root), 'utf8'));
  const lesson1 = matter(await readFile(new URL('src/content/tutorial/agent/01-从数据中学到参数.md', root), 'utf8'));
  const pyScript = await readFile(new URL('public/examples/agent/lesson01.py', root), 'utf8');

  assert.equal(readme.data.permalink, '/tutorials/agent/');
  assert.equal(lesson1.data.permalink, '/tutorials/tagent-lesson01/');
  assert.match(readme.content, /\/tutorials\/tagent-lesson01\//);
  assert.match(lesson1.content, /<param-learning-demo mode="double">/);

  const pythonBlocks = [...lesson1.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const fullScriptBlock = pythonBlocks.find((match) => match[1].includes('def predict('));
  assert.ok(fullScriptBlock, 'Lesson 1 must contain the complete lesson01.py code block');
  assert.equal(normalize(fullScriptBlock[1]), normalize(pyScript));
});
