export const TRAIN_TEST_CODE_LINES = [
  'def predict(x, weight, bias): return x * weight + bias',
  'def calculate_error(samples, w, b): return total / len(samples)',
  'for weight in range(5): for bias in range(5):  # 仅用训练集选参',
  '  error = calculate_error(train_samples, weight, bias)',
  'train_error = calculate_error(train_samples, best_weight, best_bias)',
  'test_error = calculate_error(test_samples, best_weight, best_bias)'
];

export const TRAIN_TEST_DATASETS = {
  doubling: {
    key: 'doubling',
    label: '教学例题：答案翻倍',
    samplesLabel: '训练 [(1,2),(2,4)] | 测试 [(3,8),(4,16)]',
    trainSamples: [
      { x: 1, expected: 2 },
      { x: 2, expected: 4 }
    ],
    testSamples: [
      { x: 3, expected: 8 },
      { x: 4, expected: 16 }
    ],
    plot: {
      left: 48,
      right: 414,
      top: 28,
      bottom: 286,
      xMax: 4.5,
      yMax: 17.5,
      yTicks: [0, 4, 8, 12, 16]
    }
  },
  linear_ex: {
    key: 'linear_ex',
    label: '课后练习：2x + 1',
    samplesLabel: '训练 [(1,3),(2,5)] | 测试 [(3,7),(4,9)]',
    trainSamples: [
      { x: 1, expected: 3 },
      { x: 2, expected: 5 }
    ],
    testSamples: [
      { x: 3, expected: 7 },
      { x: 4, expected: 9 }
    ],
    plot: {
      left: 48,
      right: 414,
      top: 28,
      bottom: 286,
      xMax: 4.5,
      yMax: 10.5,
      yTicks: [0, 2, 4, 6, 8, 10]
    }
  }
};

export function predictAffine(x, weight, bias) {
  return x * weight + bias;
}

export function calculateMeanError(samples, weight, bias) {
  let total = 0;
  for (const sample of samples) {
    total += Math.abs(predictAffine(sample.x, weight, bias) - sample.expected);
  }
  return Number((total / samples.length).toFixed(4));
}

function buildRows(samples, weight, bias, activeIndices = null) {
  return samples.map((sample, index) => {
    const visible = activeIndices === null || activeIndices.includes(index);
    if (!visible || weight === null || bias === null) {
      return { x: sample.x, expected: sample.expected, predicted: null, error: null };
    }
    const predicted = predictAffine(sample.x, weight, bias);
    return {
      x: sample.x,
      expected: sample.expected,
      predicted,
      error: Math.abs(predicted - sample.expected)
    };
  });
}

export function buildTrainTestSteps(mode = 'doubling') {
  const dataset = TRAIN_TEST_DATASETS[mode] ?? TRAIN_TEST_DATASETS.doubling;
  const { trainSamples, testSamples } = dataset;

  let bestWeight = null;
  let bestBias = null;
  let bestError = null;
  const searchTrace = [];

  for (let w = 0; w < 5; w += 1) {
    for (let b = 0; b < 5; b += 1) {
      const error = calculateMeanError(trainSamples, w, b);
      const improved = bestError === null || error < bestError;
      if (improved) {
        bestWeight = w;
        bestBias = b;
        bestError = error;
      }
      searchTrace.push({
        weight: w,
        bias: b,
        error,
        improved,
        bestWeight,
        bestBias,
        bestError
      });
    }
  }

  const finalTrainError = calculateMeanError(trainSamples, bestWeight, bestBias);
  const finalTestError = calculateMeanError(testSamples, bestWeight, bestBias);

  const steps = [];

  steps.push({
    kind: 'split',
    phase: '准备数据',
    title: '先把数据分成训练集和测试集',
    text: '蓝色点放进 train_samples 参与调参；右侧紫色 test_samples 先封存，选参数期间程序完全看不到。',
    formula: `train_samples = ${JSON.stringify(trainSamples.map((s) => [s.x, s.expected]))}（训练）`,
    weight: null,
    bias: null,
    bestWeight: null,
    bestBias: null,
    bestError: null,
    trainError: null,
    testError: null,
    revealTestCount: 0,
    testUnlocked: false,
    trainRows: buildRows(trainSamples, null, null),
    testRows: buildRows(testSamples, null, null),
    activeLines: [0, 1]
  });

  // Keep key milestones where best improves + 1 example showing non-improvement
  const improvements = searchTrace.filter((item) => item.improved);
  const extraCheck = searchTrace.find(
    (item) => !item.improved && item.weight === bestWeight + 1 && item.bias === 0
  );
  const selectedTrainSteps = extraCheck ? [...improvements, extraCheck] : improvements;

  for (const item of selectedTrainSteps) {
    const trainRows = buildRows(trainSamples, item.weight, item.bias);
    const meanText = `${trainRows.map((r) => r.error).join('+')} ÷ ${trainSamples.length} = ${item.error}`;
    steps.push({
      kind: 'train-search',
      phase: '仅用训练集调参',
      title: item.improved
        ? `试 (w=${item.weight}, b=${item.bias})：训练平均误差降到 ${item.error}`
        : `继续试 (w=${item.weight}, b=${item.bias})：平均误差 ${item.error} 没有更小`,
      text: item.improved
        ? `只用训练集计算平均误差 (${meanText})，刷新最优组合。注意 test_samples 依然不参与评分。`
        : `训练循环只看 train_samples：这组误差比当前的 ${item.bestError} 大，因此仍然保留 (${item.bestWeight}, ${item.bestBias})。`,
      formula: `calculate_error(train_samples, ${item.weight}, ${item.bias}) → ${meanText}`,
      weight: item.weight,
      bias: item.bias,
      bestWeight: item.bestWeight,
      bestBias: item.bestBias,
      bestError: item.bestError,
      trainError: item.error,
      testError: null,
      revealTestCount: 0,
      testUnlocked: false,
      improved: item.improved,
      trainRows,
      testRows: buildRows(testSamples, null, null),
      activeLines: [2, 3]
    });
  }

  steps.push({
    kind: 'train-lock',
    phase: '锁定参数 · 解封测试集',
    title: `25 组试完：锁定 weight = ${bestWeight}, bias = ${bestBias}`,
    text: `模型在训练集上的平均误差已经降到 ${finalTrainError}（训练题全对）。现在固定参数不再改动，正式解封测试集来检验新输入。`,
    formula: `已选参数：y = x * ${bestWeight} + ${bestBias}，train_error = ${finalTrainError}`,
    weight: bestWeight,
    bias: bestBias,
    bestWeight,
    bestBias,
    bestError: finalTrainError,
    trainError: finalTrainError,
    testError: null,
    revealTestCount: 0,
    testUnlocked: true,
    trainRows: buildRows(trainSamples, bestWeight, bestBias),
    testRows: buildRows(testSamples, null, null),
    activeLines: [4]
  });

  testSamples.forEach((sample, idx) => {
    const predicted = predictAffine(sample.x, bestWeight, bestBias);
    const err = Math.abs(predicted - sample.expected);
    const partialSamples = testSamples.slice(0, idx + 1);
    const partialMean = calculateMeanError(partialSamples, bestWeight, bestBias);
    steps.push({
      kind: 'test-eval',
      phase: `检查测试样例 ${idx + 1}`,
      title:
        err === 0
          ? `测试 x=${sample.x}：预测 ${predicted}，正确答案 ${sample.expected}（全对！）`
          : `测试 x=${sample.x}：预测 ${predicted}，正确答案 ${sample.expected}（差 ${err}！）`,
      text:
        err === 0
          ? `把新输入 x=${sample.x} 代入直线 ${sample.x}×${bestWeight}+${bestBias}=${predicted}，恰好命中测试集答案 ${sample.expected}！`
          : `直线每步只固定加 ${bestWeight}，遇到翻倍答案时立刻掉队：预测 ${predicted} 与答案 ${sample.expected} 相差 ${err}。`,
      formula: `predict(${sample.x}, ${bestWeight}, ${bestBias}) = ${predicted} vs 答案 ${sample.expected}（误差 ${err}）`,
      weight: bestWeight,
      bias: bestBias,
      bestWeight,
      bestBias,
      bestError: finalTrainError,
      trainError: finalTrainError,
      testError: idx === testSamples.length - 1 ? finalTestError : partialMean,
      revealTestCount: idx + 1,
      testUnlocked: true,
      trainRows: buildRows(trainSamples, bestWeight, bestBias),
      testRows: buildRows(
        testSamples,
        bestWeight,
        bestBias,
        Array.from({ length: idx + 1 }, (_, k) => k)
      ),
      activeLines: [5]
    });
  });

  steps.push({
    kind: 'summary',
    phase: '训练 vs 测试结论',
    title:
      finalTestError === 0
        ? `核对完成：训练误差 ${finalTrainError}，测试误差 ${finalTestError}`
        : `暴露问题：训练误差 ${finalTrainError}，测试平均误差却高达 ${finalTestError}`,
    text:
      finalTestError === 0
        ? `当新样例和训练样例遵守同一个直线规律 (${bestWeight}x+${bestBias}) 时，学到的参数对没见过的数据也能正确预测。`
        : '前两组看着对，只是巧合能被直线穿过；后两组翻倍数据证明：训练误差为 0 不代表模型真的学会了规律，必须用测试集验证！',
    formula: `train_error = ${finalTrainError} ｜ test_error = ${finalTestError}`,
    weight: bestWeight,
    bias: bestBias,
    bestWeight,
    bestBias,
    bestError: finalTrainError,
    trainError: finalTrainError,
    testError: finalTestError,
    revealTestCount: testSamples.length,
    testUnlocked: true,
    trainRows: buildRows(trainSamples, bestWeight, bestBias),
    testRows: buildRows(testSamples, bestWeight, bestBias),
    activeLines: [4, 5]
  });

  return {
    dataset,
    bestWeight,
    bestBias,
    trainError: finalTrainError,
    testError: finalTestError,
    steps
  };
}
