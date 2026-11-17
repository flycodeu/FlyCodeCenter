export const TWO_PARAM_DATASETS = {
  affine32: {
    key: 'affine32',
    label: '例题：3x + 2',
    samplesLabel: '[(1, 5), (2, 8), (3, 11)]',
    samples: [
      { x: 1, expected: 5 },
      { x: 2, expected: 8 },
      { x: 3, expected: 11 }
    ],
    weights: [0, 1, 2, 3, 4],
    biases: [0, 1, 2, 3, 4],
    queryX: 4
  },
  affine24: {
    key: 'affine24',
    label: '练习：2x + 4',
    samplesLabel: '[(1, 6), (2, 8), (3, 10)]',
    samples: [
      { x: 1, expected: 6 },
      { x: 2, expected: 8 },
      { x: 3, expected: 10 }
    ],
    weights: [0, 1, 2, 3, 4],
    biases: [0, 1, 2, 3, 4],
    queryX: 4
  }
};

export const TWO_PARAM_CODE_LINES = [
  'best_weight = best_bias = best_error = None',
  'for weight in range(5):',
  '  for bias in range(5):',
  '    error = calculate_error(weight, bias)',
  '    if best_error is None or error < best_error:',
  '      best_weight, best_bias, best_error = weight, bias, error',
  'predict(4, best_weight, best_bias)'
];

export function predictAffine(x, weight, bias) {
  return x * weight + bias;
}

export function evaluateAffinePair(samples, weight, bias) {
  const rows = samples.map(({ x, expected }) => {
    const predicted = predictAffine(x, weight, bias);
    const error = Math.abs(predicted - expected);
    return { x, expected, predicted, error };
  });
  const totalError = rows.reduce((sum, row) => sum + row.error, 0);
  return { weight, bias, rows, totalError };
}

export function buildTwoParamSteps(datasetKey = 'affine32') {
  if (!Object.hasOwn(TWO_PARAM_DATASETS, datasetKey)) {
    throw new RangeError(`Unknown two-param dataset: ${datasetKey}`);
  }
  const dataset = TWO_PARAM_DATASETS[datasetKey];
  const steps = [];
  let bestWeight = null;
  let bestBias = null;
  let bestError = null;
  const testedGrid = {};

  steps.push({
    kind: 'init',
    pairIndex: -1,
    title: '第 0 步：两个参数都从 None 起步',
    text: `这次样例 ${dataset.samplesLabel} 不再经过 (0, 0)，需要同时确定斜率 weight 和起点偏置 bias。程序将按外层 weight ∈ 0..4、内层 bias ∈ 0..4 检查全部 25 组搭配。`,
    formula: 'predict(x, weight, bias) = x * weight + bias',
    weight: null,
    bias: null,
    error: null,
    rows: dataset.samples.map(({ x, expected }) => ({ x, expected, predicted: null, error: null })),
    bestWeight: null,
    bestBias: null,
    bestError: null,
    improved: false,
    testedGrid: {},
    activeLines: [0],
    prediction: null
  });

  let pairIndex = 0;
  for (const weight of dataset.weights) {
    for (const bias of dataset.biases) {
      const evaluation = evaluateAffinePair(dataset.samples, weight, bias);
      const isFirst = bestError === null;
      const improved = isFirst || evaluation.totalError < bestError;
      const prevBestError = bestError;

      testedGrid[`${weight},${bias}`] = evaluation.totalError;
      if (improved) {
        bestWeight = weight;
        bestBias = bias;
        bestError = evaluation.totalError;
      }

      const sumExpr = evaluation.rows.map((r) => r.error).join(' + ');
      steps.push({
        kind: 'pair',
        pairIndex,
        title: `第 ${pairIndex + 1}/25 组：weight = ${weight}, bias = ${bias}`,
        text: isFirst
          ? `首次尝试组合 (${weight}, ${bias})，总误差 ${evaluation.totalError}，直接作为初始最优记录保存。`
          : improved
            ? `组合 (${weight}, ${bias}) 总误差 ${evaluation.totalError} < 之前最小误差 ${prevBestError}，把 best_weight 和 best_bias 作为一整组一起更新！`
            : `组合 (${weight}, ${bias}) 总误差 ${evaluation.totalError} 不小于当前最小 ${bestError}，保持原最佳组合 (${bestWeight}, ${bestBias})。`,
        formula: `总误差 = ${sumExpr} = ${evaluation.totalError}${improved ? ' ★ 新最优' : ''}`,
        weight,
        bias,
        error: evaluation.totalError,
        rows: evaluation.rows,
        bestWeight,
        bestBias,
        bestError,
        improved,
        testedGrid: { ...testedGrid },
        activeLines: improved ? [1, 2, 3, 4, 5] : [1, 2, 3, 4],
        prediction: null
      });
      pairIndex += 1;
    }
  }

  const predictedY = predictAffine(dataset.queryX, bestWeight, bestBias);
  steps.push({
    kind: 'predict',
    pairIndex,
    title: `训练完成：用 (${bestWeight}, ${bestBias}) 预测输入 ${dataset.queryX}`,
    text: `25 组组合全部检查完毕，总误差最小的一组是 weight = ${bestWeight}、bias = ${bestBias}（误差 ${bestError}）。代入 predict(${dataset.queryX}, ${bestWeight}, ${bestBias}) 得到 ${predictedY}。`,
    formula: `predict(${dataset.queryX}, ${bestWeight}, ${bestBias}) = ${dataset.queryX} × ${bestWeight} + ${bestBias} = ${predictedY}`,
    weight: bestWeight,
    bias: bestBias,
    error: bestError,
    rows: evaluateAffinePair(dataset.samples, bestWeight, bestBias).rows,
    bestWeight,
    bestBias,
    bestError,
    improved: false,
    testedGrid: { ...testedGrid },
    activeLines: [6],
    prediction: { x: dataset.queryX, y: predictedY, exact: bestError === 0 }
  });

  return { dataset, steps };
}
