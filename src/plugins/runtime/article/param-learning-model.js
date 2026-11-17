export const DATASETS = {
  double: {
    key: 'double',
    label: '例题：2 倍规律',
    samplesLabel: '[(1, 2), (2, 4), (3, 6)]',
    samples: [
      { x: 1, expected: 2 },
      { x: 2, expected: 4 },
      { x: 3, expected: 6 }
    ],
    candidates: [1, 2, 3, 4],
    queryX: 4
  },
  triple: {
    key: 'triple',
    label: '练习：3 倍规律',
    samplesLabel: '[(1, 3), (2, 6), (3, 9)]',
    samples: [
      { x: 1, expected: 3 },
      { x: 2, expected: 6 },
      { x: 3, expected: 9 }
    ],
    candidates: [1, 2, 3, 4],
    queryX: 4
  }
};

export const CODE_LINES = [
  'best_weight = None; best_error = None',
  'for weight in [1, 2, 3, 4]:',
  '  total_error = 0',
  '  for x, expected in samples:',
  '    predicted = predict(x, weight)',
  '    total_error += abs(predicted - expected)',
  '  if best_error is None or total_error < best_error:',
  '    best_weight, best_error = weight, total_error',
  'predict(4, best_weight)'
];

export function predictValue(x, weight) {
  return x * weight;
}

export function evaluateWeight(samples, weight) {
  const rows = samples.map(({ x, expected }) => {
    const predicted = predictValue(x, weight);
    const error = Math.abs(predicted - expected);
    return { x, expected, predicted, error };
  });
  const totalError = rows.reduce((sum, row) => sum + row.error, 0);
  return { weight, rows, totalError };
}

export function buildLessonSteps(datasetKey = 'double') {
  if (!Object.hasOwn(DATASETS, datasetKey)) {
    throw new RangeError(`Unknown dataset: ${datasetKey}`);
  }
  const dataset = DATASETS[datasetKey];
  const steps = [];
  let bestWeight = null;
  let bestError = null;
  let testedErrors = {};

  steps.push({
    kind: 'init',
    title: '先摆好样例和“待定公式”',
    text: `左上坐标系里是 3 组带正确答案的样例 ${dataset.samplesLabel}。程序只约定计算方式 x * weight，还不知道 weight 取几，所以先把 best_weight 和 best_error 设成 None。`,
    formula: 'predict(x, weight) = x * weight · 候选参数 [1, 2, 3, 4]',
    activeWeight: null,
    prevWeight: 0,
    currentRows: dataset.samples.map(({ x, expected }) => ({ x, expected, predicted: null, error: null })),
    totalError: null,
    bestWeight: null,
    bestError: null,
    improved: false,
    testedErrors: {},
    activeLines: [0],
    prediction: null
  });

  dataset.candidates.forEach((weight, index) => {
    const evaluation = evaluateWeight(dataset.samples, weight);
    const prevWeight = index === 0 ? 0 : dataset.candidates[index - 1];
    const nextTested = { ...testedErrors, [weight]: evaluation.totalError };
    const absExpr = evaluation.rows.map((row) => `|${row.predicted}−${row.expected}|`).join(' + ');
    const sumExpr = evaluation.rows.map((row) => row.error).join(' + ');

    steps.push({
      kind: 'evaluate',
      title: `第 ${index + 1} 轮：尝试 weight = ${weight}`,
      text: `把 weight = ${weight} 代入 x * ${weight}，依次算出 3 组样例的预测结果与绝对误差，再累加进 total_error。`,
      formula: `total_error = ${absExpr} = ${sumExpr} = ${evaluation.totalError}`,
      activeWeight: weight,
      prevWeight,
      currentRows: evaluation.rows,
      totalError: evaluation.totalError,
      bestWeight,
      bestError,
      improved: false,
      testedErrors: nextTested,
      activeLines: [1, 2, 3, 4, 5],
      prediction: null
    });

    const isFirst = bestError === null;
    const improved = isFirst || evaluation.totalError < bestError;
    const prevBestWeight = bestWeight;
    const prevBestError = bestError;
    if (improved) {
      bestWeight = weight;
      bestError = evaluation.totalError;
    }

    steps.push({
      kind: 'compare',
      title: isFirst
        ? `首次记录：暂存 weight = ${weight}`
        : improved
          ? `发现更优参数：更新为 weight = ${weight}`
          : `误差没有更小：继续保留 weight = ${bestWeight}`,
      text: isFirst
        ? `此时 best_error 是 None，说明还没记录过任何结果，直接把 weight = ${weight}（总误差 ${evaluation.totalError}）记作当前最优。`
        : improved
          ? `本轮总误差 ${evaluation.totalError} 小于之前的最小误差 ${prevBestError}，条件成立，把最优参数替换为 weight = ${weight}。`
          : `本轮总误差 ${evaluation.totalError} 不小于当前最小误差 ${prevBestError}，不更新，继续保留 weight = ${prevBestWeight}。`,
      formula: isFirst
        ? `best_error is None 为真 → best_weight = ${weight}, best_error = ${evaluation.totalError}`
        : improved
          ? `${evaluation.totalError} < ${prevBestError} 为真 → best_weight = ${weight}, best_error = ${evaluation.totalError}`
          : `${evaluation.totalError} < ${prevBestError} 为假 → 保持 best_weight = ${bestWeight}（最小误差 ${bestError}）`,
      activeWeight: weight,
      prevWeight: weight,
      currentRows: evaluation.rows,
      totalError: evaluation.totalError,
      bestWeight,
      bestError,
      improved,
      testedErrors: nextTested,
      activeLines: improved ? [6, 7] : [6],
      prediction: null
    });

    testedErrors = nextTested;
  });

  const predictedY = predictValue(dataset.queryX, bestWeight);
  steps.push({
    kind: 'predict',
    title: `训练结束：用 weight = ${bestWeight} 预测新输入 ${dataset.queryX}`,
    text: `4 个候选参数都检查完了，误差最小的是 weight = ${bestWeight}（总误差 ${bestError}）。现在固定这个参数，把新输入 x = ${dataset.queryX} 代入 predict() 得到 ${predictedY}。`,
    formula: `predict(${dataset.queryX}, ${bestWeight}) = ${dataset.queryX} × ${bestWeight} = ${predictedY}`,
    activeWeight: bestWeight,
    prevWeight: bestWeight,
    currentRows: evaluateWeight(dataset.samples, bestWeight).rows,
    totalError: bestError,
    bestWeight,
    bestError,
    improved: false,
    testedErrors,
    activeLines: [8],
    prediction: { x: dataset.queryX, y: predictedY }
  });

  return { dataset, steps };
}
