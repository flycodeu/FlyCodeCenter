export const FEATURE_TRANSFORM_CODE_LINES = [
  'def predict(x, weight, bias):',
  '  transformed_x = 2 ** x  # 先把输入做幂次变换',
  '  return transformed_x * weight + bias',
  'for weight in range(5): for bias in range(5):',
  '  error = calculate_error(train_samples, weight, bias)',
  'train_error = ... ; test_error = calculate_error(test_samples, ...)'
];

export const FEATURE_TRANSFORM_DATASETS = {
  exp_basic: {
    key: 'exp_basic',
    label: '教学例题：y = 2^x',
    samplesLabel: '训练 x=1..4 → 2..16 | 测试 5→32, 6→64',
    trainSamples: [
      { x: 1, expected: 2 },
      { x: 2, expected: 4 },
      { x: 3, expected: 8 },
      { x: 4, expected: 16 }
    ],
    testSamples: [
      { x: 5, expected: 32 },
      { x: 6, expected: 64 }
    ],
    xMax: 6.4,
    uMax: 68,
    yMax: 70,
    yTicks: [0, 16, 32, 48, 64]
  },
  exp_exercise: {
    key: 'exp_exercise',
    label: '课后练习：y = 3×(2^x) + 1',
    samplesLabel: '训练 x=1..4 → 7..49 | 测试 5→97, 6→193',
    trainSamples: [
      { x: 1, expected: 7 },
      { x: 2, expected: 13 },
      { x: 3, expected: 25 },
      { x: 4, expected: 49 }
    ],
    testSamples: [
      { x: 5, expected: 97 },
      { x: 6, expected: 193 }
    ],
    xMax: 6.4,
    uMax: 68,
    yMax: 205,
    yTicks: [0, 50, 100, 150, 200]
  }
};

export function transformInput(x) {
  return 2 ** x;
}

export function predictTransformed(x, weight, bias) {
  return transformInput(x) * weight + bias;
}

export function calculateTransformedMeanError(samples, weight, bias) {
  let total = 0;
  for (const sample of samples) {
    total += Math.abs(predictTransformed(sample.x, weight, bias) - sample.expected);
  }
  return Number((total / samples.length).toFixed(4));
}

function buildRows(samples, weight, bias, activeIndices = null) {
  return samples.map((sample, idx) => {
    const u = transformInput(sample.x);
    const active = activeIndices === null || activeIndices.includes(idx);
    if (!active || weight === null || bias === null) {
      return { x: sample.x, u, expected: sample.expected, predicted: null, error: null };
    }
    const predicted = predictTransformed(sample.x, weight, bias);
    return {
      x: sample.x,
      u,
      expected: sample.expected,
      predicted,
      error: Math.abs(predicted - sample.expected)
    };
  });
}

export function buildFeatureTransformSteps(mode = 'exp_basic') {
  const dataset = FEATURE_TRANSFORM_DATASETS[mode] ?? FEATURE_TRANSFORM_DATASETS.exp_basic;
  const { trainSamples, testSamples } = dataset;

  let bestWeight = null;
  let bestBias = null;
  let bestError = null;
  const searchTrace = [];

  for (let w = 0; w < 5; w += 1) {
    for (let b = 0; b < 5; b += 1) {
      const error = calculateTransformedMeanError(trainSamples, w, b);
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

  const finalTrainError = calculateTransformedMeanError(trainSamples, bestWeight, bestBias);
  const finalTestError = calculateTransformedMeanError(testSamples, bestWeight, bestBias);

  const steps = [];

  steps.push({
    kind: 'init',
    phase: '原始输入分布',
    title: '先看原始输入 x：答案越来越陡，不再是一条直线',
    text: '在上面的原始坐标里，x 每增加 1，答案不是固定加同一个数，而是不断翻倍（或按翻倍放缩）。直接用 x * weight + bias 无法穿过全部点。',
    formula: '先观察 train_samples，test_samples (x=5, 6) 暂时封存',
    showTransformedSpace: false,
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
    activeLines: [0]
  });

  steps.push({
    kind: 'transform',
    phase: '变换输入 2 ** x',
    title: '关键一步：先把每个输入 x 变成 u = 2 ** x',
    text: '看看下方坐标图的变化：把横坐标从 [1, 2, 3, 4] 换成 [2, 4, 8, 16] 后，所有原本弯曲的训练点瞬间排成了一条笔直的线！',
    formula: 'transformed_x = 2 ** x  （1→2, 2→4, 3→8, 4→16）',
    showTransformedSpace: true,
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
    activeLines: [1]
  });

  const improvements = searchTrace.filter((item) => item.improved);
  const extraCheck = searchTrace.find(
    (item) => !item.improved && item.weight === bestWeight + 1 && item.bias === 0
  );
  const selectedTrainSteps = extraCheck ? [...improvements, extraCheck] : improvements;

  for (const item of selectedTrainSteps) {
    const trainRows = buildRows(trainSamples, item.weight, item.bias);
    steps.push({
      kind: 'train-search',
      phase: '在新空间找参数',
      title: item.improved
        ? `试 (w=${item.weight}, b=${item.bias})：变换后平均误差降到 ${item.error}`
        : `再试 (w=${item.weight}, b=${item.bias})：误差 ${item.error} 反弹，保留 (${item.bestWeight}, ${item.bestBias})`,
      text: item.improved
        ? `训练循环完全沿用上一课，只是 predict() 改算 (2 ** x) × ${item.weight} + ${item.bias}。`
        : `测试更多组合不会比 ${item.bestError} 更低，因此继续保留最优参数。`,
      formula: `calculate_error(train_samples, ${item.weight}, ${item.bias}) → 平均误差 ${item.error}`,
      showTransformedSpace: true,
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
      activeLines: [2, 3, 4]
    });
  }

  steps.push({
    kind: 'train-lock',
    phase: '锁定最优参数',
    title: `选中最优参数：weight = ${bestWeight}, bias = ${bestBias}`,
    text: `25 组试完，训练集平均误差降为 ${finalTrainError}。现在固定 (weight=${bestWeight}, bias=${bestBias})，用测试集 (x=5, 6) 检验预测能力。`,
    formula: `predict(x) = (2 ** x) * ${bestWeight} + ${bestBias}`,
    showTransformedSpace: true,
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
    activeLines: [2, 5]
  });

  testSamples.forEach((sample, idx) => {
    const u = transformInput(sample.x);
    const predicted = predictTransformed(sample.x, bestWeight, bestBias);
    const partialMean = calculateTransformedMeanError(testSamples.slice(0, idx + 1), bestWeight, bestBias);
    steps.push({
      kind: 'test-eval',
      phase: `检验新输入 x = ${sample.x}`,
      title: `测试 x=${sample.x} → 2**${sample.x}=${u} → 预测 ${predicted}（答案 ${sample.expected}）`,
      text: `先通过我们设计的 2 ** ${sample.x} 得到 ${u}，再乘 ${bestWeight} 加 ${bestBias} 算出 ${predicted}，精准命中未见过的新答案！`,
      formula: `(2 ** ${sample.x}) × ${bestWeight} + ${bestBias} = ${u} × ${bestWeight} + ${bestBias} = ${predicted}`,
      showTransformedSpace: true,
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
      activeLines: [1, 2, 5]
    });
  });

  steps.push({
    kind: 'summary',
    phase: '模型设计 vs 参数学习',
    title: `全部命中：训练误差 ${finalTrainError}，测试误差 ${finalTestError}`,
    text: `人负责在 predict() 里设计“先算 2 ** x”的计算结构；程序负责在训练集里找出 weight=${bestWeight}、bias=${bestBias}。两者配合让新输入 5 和 6 全部答对。`,
    formula: `预测结果 = (2 ** x) * ${bestWeight} + ${bestBias} ｜ test_error = ${finalTestError}`,
    showTransformedSpace: true,
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
    activeLines: [1, 2, 5]
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
