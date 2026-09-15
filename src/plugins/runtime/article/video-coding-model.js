// A small, unquantized grayscale teaching model, not an H.264/HEVC encoder.
export const COLS = 12;
export const ROWS = 8;
export const BACKGROUND = 40;
export const BLOCK = { y: 2, width: 4, height: 4 };

export function makeFrame(center, level = 180, changed = false) {
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    if ((x - center) ** 2 + (y - 3.5) ** 2 > 3.2) return BACKGROUND;
    if (changed && x === center && y === 3) return 240;
    return level;
  });
}

export function blockError(reference, current, sourceX, targetX) {
  let total = 0;
  for (let y = BLOCK.y; y < BLOCK.y + BLOCK.height; y++) {
    for (let x = 0; x < BLOCK.width; x++) {
      total += Math.abs(reference[y * COLS + sourceX + x] - current[y * COLS + targetX + x]);
    }
  }
  return total;
}

export function findReferenceBlock(reference, current, targetX) {
  const candidates = Array.from({ length: COLS - BLOCK.width + 1 }, (_, x) => ({
    x, error: blockError(reference, current, x, targetX)
  }));
  const best = candidates.reduce((a, b) => b.error < a.error ? b : a);
  return { ...best, candidates };
}

export function moveBlock(reference, sourceX, targetX) {
  const result = Array(COLS * ROWS).fill(BACKGROUND);
  for (let y = BLOCK.y; y < BLOCK.y + BLOCK.height; y++) {
    for (let x = 0; x < BLOCK.width; x++) {
      result[y * COLS + targetX + x] = reference[y * COLS + sourceX + x];
    }
  }
  return result;
}

export function createPrediction(mode = 'P', changed = true) {
  if (!['I', 'P', 'B'].includes(mode)) throw new RangeError('Unknown frame type');
  const center = mode === 'B' ? 6 : 7;
  const targetX = center - 2;
  const current = makeFrame(center, changed ? 210 : 180, changed);
  const references = mode === 'I' ? [] : mode === 'P' ? [makeFrame(3)] : [makeFrame(3, 160), makeFrame(9, 200)];
  const matches = references.map(reference => findReferenceBlock(reference, current, targetX));
  const aligned = references.map((reference, i) => moveBlock(reference, matches[i].x, targetX));
  // I: a DC-like predictor formed from already reconstructed neighboring samples.
  const neighbors = Array(COLS + ROWS).fill(BACKGROUND);
  const dc = neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length;
  const prediction = mode === 'I' ? Array(COLS * ROWS).fill(dc)
    : current.map((_, i) => aligned.reduce((sum, frame) => sum + frame[i], 0) / aligned.length);
  const residual = current.map((value, i) => value - prediction[i]);
  const reconstructed = prediction.map((value, i) => value + residual[i]);
  const sampleIndex = 3 * COLS + center;
  return { mode, current, references, neighbors, matches, aligned, prediction, residual, reconstructed, targetX,
    sampleIndex, changedPixels: residual.filter(value => value !== 0).length };
}

export const ORDER_STEPS = [
  { title: '先准备解码，再按时间显示', text: '三幅画面的显示顺序是 I0、B1、P2。B1 在本例中要参考两端，所以解码器必须先得到 I0 和 P2。', decoded: [], output: null, active: null },
  { title: '① 解码 I0', text: 'I0 使用本幅画面内的依据重建。解码器把结果保存起来，后面可以拿它作参考。', decoded: ['I0'], output: null, active: 'I0' },
  { title: '② 先解码 P2', text: 'P2 使用 I0 的参考数据和自己的差值重建。它的显示时间在后面，但现在已经可以先解码、暂存。', decoded: ['I0', 'P2'], output: null, active: 'P2' },
  { title: '③ 再解码 B1', text: '两幅参考画面都已准备好。利用它们和 B1 自己携带的运动信息、差值，才能重建 B1。只靠两端画面并不能知道真实的中间画面。', decoded: ['I0', 'P2', 'B1'], output: null, active: 'B1' },
  { title: '④ 显示 I0 · 0 ms', text: '现在按显示时间播放。观众先看到 I0，小球在左边。', decoded: ['I0', 'P2', 'B1'], output: 'I0', active: null },
  { title: '⑤ 显示 B1 · 40 ms', text: '再显示刚才已经重建好的 B1，小球在中间。这里没有在播放时凭空补出一帧。', decoded: ['I0', 'P2', 'B1'], output: 'B1', active: null },
  { title: '⑥ 显示 P2 · 80 ms', text: '最后显示 P2，小球在右边。你看到的仍是 I0 → B1 → P2，解码准备顺序则是 I0 → P2 → B1。', decoded: ['I0', 'P2', 'B1'], output: 'P2', active: null }
];

export const ORDER_FRAMES = [
  { id: 'I0', time: '0 ms', pixels: makeFrame(3, 160) },
  { id: 'B1', time: '40 ms', pixels: makeFrame(6, 210, true) },
  { id: 'P2', time: '80 ms', pixels: makeFrame(9, 200) }
];
