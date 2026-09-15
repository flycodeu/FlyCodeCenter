import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, createPrediction, ORDER_STEPS } from '../../src/plugins/runtime/article/video-coding-model.js';

test('all three predictors reconstruct the known current picture with signed residuals', () => {
  for (const mode of ['I', 'P', 'B']) {
    for (const changed of [true, false]) {
      const scene = createPrediction(mode, changed);
      assert.equal(scene.current.length, COLS * ROWS);
      assert.deepEqual(scene.reconstructed, scene.current);
      for (let i = 0; i < scene.current.length; i++) {
        assert.equal(scene.prediction[i] + scene.residual[i], scene.current[i]);
      }
    }
  }
});

test('I uses current-picture neighbors, not a temporal reference picture', () => {
  const scene = createPrediction('I');
  assert.equal(scene.references.length, 0);
  assert.deepEqual([...new Set(scene.prediction)], [40]);
  assert.equal(scene.residual[scene.sampleIndex], 200);
});

test('P searches the known current block and needs residual to recover changed brightness', () => {
  const scene = createPrediction('P');
  assert.equal(scene.matches[0].x, 1);
  assert.equal(scene.targetX, 5);
  assert.equal(scene.prediction[scene.sampleIndex], 180);
  assert.equal(scene.current[scene.sampleIndex], 240);
  assert.equal(scene.residual[scene.sampleIndex], 60);
  assert.equal(createPrediction('P', false).changedPixels, 0);
});

test('B aligns both reference blocks before averaging and still needs its own residual', () => {
  const scene = createPrediction('B');
  assert.deepEqual(scene.matches.map(match => match.x), [1, 7]);
  assert.equal(scene.targetX, 4);
  // Neither unaligned reference contains the ball at this current-picture position.
  assert.equal(scene.references[0][scene.sampleIndex], 40);
  assert.equal(scene.references[1][scene.sampleIndex], 40);
  assert.deepEqual(scene.aligned.map(frame => frame[scene.sampleIndex]), [160, 200]);
  assert.equal(scene.prediction[scene.sampleIndex], 180);
  assert.equal(scene.reconstructed[scene.sampleIndex], 240);
  assert.equal(createPrediction('B', false).changedPixels, 0);
});

test('the B picture is unavailable until both references are decoded, then display order is restored', () => {
  for (const step of ORDER_STEPS) {
    if (step.decoded.includes('B1')) {
      assert(step.decoded.includes('I0'));
      assert(step.decoded.includes('P2'));
    }
    if (step.output) assert(step.decoded.includes(step.output));
  }
  assert.deepEqual(ORDER_STEPS.filter(step => step.active).map(step => step.active), ['I0', 'P2', 'B1']);
  assert.deepEqual(ORDER_STEPS.filter(step => step.output).map(step => step.output), ['I0', 'B1', 'P2']);
});
