import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import matter from 'gray-matter';
import {
  buildTrainTestSteps,
  calculateMeanError,
  TRAIN_TEST_DATASETS
} from '../../src/plugins/runtime/article/train-test-model.js';

const root = new URL('../../', import.meta.url);
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('doubling dataset selects (2, 0) on train with 0 error and gets 5.0 error on test', () => {
  const result = buildTrainTestSteps('doubling');
  assert.equal(result.bestWeight, 2);
  assert.equal(result.bestBias, 0);
  assert.equal(result.trainError, 0);
  assert.equal(result.testError, 5);

  const { trainSamples, testSamples } = TRAIN_TEST_DATASETS.doubling;
  assert.equal(calculateMeanError(trainSamples, 2, 0), 0);
  assert.equal(calculateMeanError(testSamples, 2, 0), 5);
  assert.equal(result.steps[0].testUnlocked, false);
  assert.equal(result.steps.at(-1).testError, 5);
});

test('linear exercise finds (2, 1) with 0 error on both train and test', () => {
  const result = buildTrainTestSteps('linear_ex');
  assert.equal(result.bestWeight, 2);
  assert.equal(result.bestBias, 1);
  assert.equal(result.trainError, 0);
  assert.equal(result.testError, 0);
  assert.equal(result.steps.at(-1).testError, 0);
});

test('lesson 4 markdown matches lesson04.py and links properly from agent README', async () => {
  const readme = matter(await readFile(new URL('src/content/tutorial/agent/README.md', root), 'utf8'));
  const lesson4 = matter(await readFile(new URL('src/content/tutorial/agent/04-用新数据检查模型.md', root), 'utf8'));
  const pyScript = await readFile(new URL('public/examples/agent/lesson04.py', root), 'utf8');

  assert.equal(lesson4.data.permalink, '/tutorials/tagent-lesson04/');
  assert.match(readme.content, /\/tutorials\/tagent-lesson04\//);
  assert.match(lesson4.content, /<train-test-demo mode="doubling">/);

  const pythonBlocks = [...lesson4.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const fullScriptBlock = pythonBlocks.find((match) =>
    match[1].includes('def calculate_error(samples, weight, bias):')
  );
  assert.ok(fullScriptBlock, 'Lesson 4 must contain the complete lesson04.py code block');
  assert.equal(normalize(fullScriptBlock[1]), normalize(pyScript));
});
