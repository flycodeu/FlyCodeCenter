import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import matter from 'gray-matter';
import {
  buildFeatureTransformSteps,
  calculateTransformedMeanError,
  FEATURE_TRANSFORM_DATASETS,
  predictTransformed
} from '../../src/plugins/runtime/article/feature-transform-model.js';

const root = new URL('../../', import.meta.url);
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('exp_basic transforms input via 2**x, learns (1, 0), and predicts 5->32 and 6->64 with 0 error', () => {
  const result = buildFeatureTransformSteps('exp_basic');
  assert.equal(result.bestWeight, 1);
  assert.equal(result.bestBias, 0);
  assert.equal(result.trainError, 0);
  assert.equal(result.testError, 0);
  assert.equal(predictTransformed(5, 1, 0), 32);
  assert.equal(predictTransformed(6, 1, 0), 64);

  assert.equal(result.steps[0].showTransformedSpace, false);
  assert.equal(result.steps[1].showTransformedSpace, true);
  assert.equal(result.steps.at(-1).testError, 0);
});

test('exp_exercise learns (3, 1) and predicts 5->97 and 6->193 with 0 error', () => {
  const result = buildFeatureTransformSteps('exp_exercise');
  assert.equal(result.bestWeight, 3);
  assert.equal(result.bestBias, 1);
  assert.equal(result.trainError, 0);
  assert.equal(result.testError, 0);
  assert.equal(predictTransformed(5, 3, 1), 97);
  assert.equal(predictTransformed(6, 3, 1), 193);
  assert.equal(calculateTransformedMeanError(FEATURE_TRANSFORM_DATASETS.exp_exercise.testSamples, 3, 1), 0);
});

test('lesson 5 markdown matches lesson05.py and links properly from agent README', async () => {
  const readme = matter(await readFile(new URL('src/content/tutorial/agent/README.md', root), 'utf8'));
  const lesson5 = matter(await readFile(new URL('src/content/tutorial/agent/05-先变换输入再训练参数.md', root), 'utf8'));
  const pyScript = await readFile(new URL('public/examples/agent/lesson05.py', root), 'utf8');

  assert.equal(lesson5.data.permalink, '/tutorials/tagent-lesson05/');
  assert.match(readme.content, /\/tutorials\/tagent-lesson05\//);
  assert.match(lesson5.content, /<feature-transform-demo mode="exp_basic">/);

  const pythonBlocks = [...lesson5.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const fullScriptBlock = pythonBlocks.find((match) =>
    match[1].includes('transformed_x = 2 ** x')
  );
  assert.ok(fullScriptBlock, 'Lesson 5 must contain the complete lesson05.py code block');
  assert.equal(normalize(fullScriptBlock[1]), normalize(pyScript));
});
