import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import matter from 'gray-matter';
import { buildStepAdjustSteps, calculateStepError, formatNumber } from '../../src/plugins/runtime/article/step-adjust-model.js';

const root = new URL('../../', import.meta.url);
const normalize = (value) => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('fine preset (step = 0.1) walks from 1.0 to 2.5 in 16 loop rounds and predicts 10', () => {
  const { steps } = buildStepAdjustSteps('fine');
  // init + 15 moves + 1 stop + 1 predict = 18 steps
  assert.equal(steps.length, 18);
  assert.equal(steps[0].kind, 'init');
  assert.equal(formatNumber(steps[0].weight), '1');

  const moves = steps.filter((s) => s.kind === 'move');
  assert.equal(moves.length, 15);
  assert.ok(moves.every((m) => m.action === 'right'));

  const stop = steps.find((s) => s.kind === 'stop');
  assert.equal(formatNumber(stop.weight), '2.5');
  assert.equal(formatNumber(stop.currentError), '0');

  const last = steps.at(-1);
  assert.equal(last.kind, 'predict');
  assert.deepEqual(
    { x: last.prediction.x, y: Number(formatNumber(last.prediction.y)), exact: last.prediction.exact },
    { x: 4, y: 10, exact: true }
  );
});

test('coarse preset (step = 1.0) overshoots 2.5 and stops prematurely at 2.0 with error 3.0', () => {
  const { steps } = buildStepAdjustSteps('coarse');
  // init + 1 move (1 -> 2) + 1 stop (at 2) + 1 predict = 4 steps
  assert.equal(steps.length, 4);
  assert.equal(steps[1].action, 'right');
  assert.equal(formatNumber(steps[1].nextWeight), '2');

  assert.equal(steps[2].kind, 'stop');
  assert.equal(formatNumber(steps[2].weight), '2');
  assert.equal(formatNumber(steps[2].currentError), '3');
  assert.equal(formatNumber(steps[2].leftError), '9');
  assert.equal(formatNumber(steps[2].rightError), '3');

  const last = steps.at(-1);
  assert.equal(last.prediction.exact, false);
  assert.equal(formatNumber(last.prediction.y), '8');
});

test('reverse preset (weight = 3.5, step = 0.1) uses left steps down to 2.5', () => {
  const { steps } = buildStepAdjustSteps('reverse');
  const moves = steps.filter((s) => s.kind === 'move');
  assert.equal(moves.length, 10);
  assert.ok(moves.every((m) => m.action === 'left'));
  const last = steps.at(-1);
  assert.equal(formatNumber(last.weight), '2.5');
  assert.equal(formatNumber(calculateStepError(last.weight)), '0');
  assert.equal(last.prediction.exact, true);
});

test('unknown preset throws RangeError', () => {
  assert.throws(() => buildStepAdjustSteps('invalid'), RangeError);
});

test('lesson 2 markdown matches lesson02.py and links properly from agent README', async () => {
  const readme = matter(await readFile(new URL('src/content/tutorial/agent/README.md', root), 'utf8'));
  const lesson2 = matter(await readFile(new URL('src/content/tutorial/agent/02-让程序自己小步调整参数.md', root), 'utf8'));
  const pyScript = await readFile(new URL('public/examples/agent/lesson02.py', root), 'utf8');

  assert.equal(lesson2.data.permalink, '/tutorials/tagent-lesson02/');
  assert.match(readme.content, /\/tutorials\/tagent-lesson02\//);
  assert.match(lesson2.content, /<step-adjust-demo mode="fine">/);

  const pythonBlocks = [...lesson2.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  const fullScriptBlock = pythonBlocks.find((match) => match[1].includes('def calculate_error('));
  assert.ok(fullScriptBlock, 'Lesson 2 must contain the complete lesson02.py code block');
  assert.equal(normalize(fullScriptBlock[1]), normalize(pyScript));
});
