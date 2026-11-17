import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import matter from 'gray-matter';
import { buildTwoParamSteps, evaluateAffinePair, TWO_PARAM_DATASETS } from '../../src/plugins/runtime/article/two-param-model.js';

const root = new URL('../../', import.meta.url);
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('affine32 scans 25 (weight, bias) pairs, finds (3, 2) with error 0, and predicts 14', () => {
  const { dataset, steps } = buildTwoParamSteps('affine32');
  assert.equal(steps.length, 27);
  assert.equal(steps[0].kind, 'init');

  assert.equal(evaluateAffinePair(dataset.samples, 2, 2).totalError, 6);
  assert.equal(evaluateAffinePair(dataset.samples, 3, 0).totalError, 6);
  assert.equal(evaluateAffinePair(dataset.samples, 3, 2).totalError, 0);

  const last = steps.at(-1);
  assert.equal(last.kind, 'predict');
  assert.equal(last.bestWeight, 3);
  assert.equal(last.bestBias, 2);
  assert.equal(last.bestError, 0);
  assert.deepEqual(last.prediction, { x: 4, y: 14, exact: true });
});

test('affine24 scans 25 pairs, finds (2, 4) with error 0, and predicts 12', () => {
  const { steps } = buildTwoParamSteps('affine24');
  assert.equal(steps.length, 27);
  const last = steps.at(-1);
  assert.equal(last.bestWeight, 2);
  assert.equal(last.bestBias, 4);
  assert.equal(last.bestError, 0);
  assert.deepEqual(last.prediction, { x: 4, y: 12, exact: true });
  assert.equal(Object.keys(TWO_PARAM_DATASETS).length, 2);
});

test('unknown two-param dataset throws RangeError', () => {
  assert.throws(() => buildTwoParamSteps('missing'), RangeError);
});

test('lesson 3 markdown matches lesson03.py and links properly from agent README', async () => {
  const readme = matter(await readFile(new URL('src/content/tutorial/agent/README.md', root), 'utf8'));
  const lesson3 = matter(await readFile(new URL('src/content/tutorial/agent/03-让模型学会乘一个数再加一个数.md', root), 'utf8'));
  const pyScript = await readFile(new URL('public/examples/agent/lesson03.py', root), 'utf8');

  assert.equal(lesson3.data.permalink, '/tutorials/tagent-lesson03/');
  assert.match(readme.content, /\/tutorials\/tagent-lesson03\//);
  assert.match(lesson3.content, /<two-param-demo mode="affine32">/);

  const pythonBlocks = [...lesson3.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const fullScriptBlock = pythonBlocks.find((match) => match[1].includes('def calculate_error(weight, bias):'));
  assert.ok(fullScriptBlock, 'Lesson 3 must contain the complete lesson03.py code block');
  assert.equal(normalize(fullScriptBlock[1]), normalize(pyScript));
});
