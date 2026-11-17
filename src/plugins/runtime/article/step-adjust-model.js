export const STEP_SAMPLES = [
  { x: 1, expected: 2.5 },
  { x: 2, expected: 5.0 },
  { x: 3, expected: 7.5 }
];

export const STEP_QUERY_X = 4;

export const STEP_PRESETS = {
  fine: {
    key: 'fine',
    label: '精细步长：step = 0.1',
    detail: 'w=1.0, step=0.1',
    initialWeight: 1.0,
    step: 0.1,
    maxAttempts: 100
  },
  coarse: {
    key: 'coarse',
    label: '步子太大：step = 1.0',
    detail: 'w=1.0, step=1.0',
    initialWeight: 1.0,
    step: 1.0,
    maxAttempts: 100
  },
  reverse: {
    key: 'reverse',
    label: '从大往小：w = 3.5',
    detail: 'w=3.5, step=0.1',
    initialWeight: 3.5,
    step: 0.1,
    maxAttempts: 100
  }
};

export const STEP_CODE_LINES = [
  'weight = {INIT}; step = {STEP}',
  'for attempt in range(100):',
  '  cur = calculate_error(weight)',
  '  left = calculate_error(weight - step)',
  '  right = calculate_error(weight + step)',
  '  if left < cur and left <= right:',
  '    weight -= step',
  '  elif right < cur:',
  '    weight += step',
  '  else:',
  '    break',
  'predict(4, weight)'
];

export function formatNumber(value, digits = 2) {
  const rounded = Number(Number(value).toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function calculateStepError(weight, samples = STEP_SAMPLES) {
  return samples.reduce((sum, sample) => sum + Math.abs(sample.x * weight - sample.expected), 0);
}

export function buildStepAdjustSteps(presetKey = 'fine') {
  if (!Object.hasOwn(STEP_PRESETS, presetKey)) {
    throw new RangeError(`Unknown step preset: ${presetKey}`);
  }
  const preset = STEP_PRESETS[presetKey];
  const steps = [];
  let weight = preset.initialWeight;
  const trail = [weight];
  const initErr = calculateStepError(weight);

  steps.push({
    kind: 'init',
    attempt: 0,
    title: `第 0 步：从 weight = ${formatNumber(weight)} 出发`,
    text: `这次样例规律是 2.5 倍（1→2.5, 2→5.0, 3→7.5）。程序不看枚举列表，只从 weight = ${formatNumber(weight)} 出发，每次试着左右挪动 step = ${formatNumber(preset.step)}。`,
    formula: `初始位置：weight = ${formatNumber(weight)} · 总误差 = ${formatNumber(initErr)}`,
    weight,
    prevWeight: weight,
    nextWeight: weight,
    currentError: initErr,
    leftWeight: weight - preset.step,
    leftError: calculateStepError(weight - preset.step),
    rightWeight: weight + preset.step,
    rightError: calculateStepError(weight + preset.step),
    action: 'init',
    trail: [...trail],
    activeLines: [0],
    prediction: null
  });

  for (let attempt = 0; attempt < preset.maxAttempts; attempt += 1) {
    const currentError = calculateStepError(weight);
    const leftWeight = weight - preset.step;
    const rightWeight = weight + preset.step;
    const leftError = calculateStepError(leftWeight);
    const rightError = calculateStepError(rightWeight);

    let action = 'stop';
    let nextWeight = weight;
    if (leftError < currentError && leftError <= rightError) {
      action = 'left';
      nextWeight = leftWeight;
    } else if (rightError < currentError) {
      action = 'right';
      nextWeight = rightWeight;
    }

    const roundNo = attempt + 1;
    const curFmt = formatNumber(currentError);
    const leftFmt = formatNumber(leftError);
    const rightFmt = formatNumber(rightError);
    const wFmt = formatNumber(weight);
    const nextFmt = formatNumber(nextWeight);
    const stepFmt = formatNumber(preset.step);

    let title;
    let text;
    let formula;
    let activeLines;

    if (action === 'right') {
      title = `第 ${roundNo} 轮：往右更好 → weight + ${stepFmt}`;
      text = `站在 ${wFmt}（误差 ${curFmt}）：往左到 ${formatNumber(leftWeight)} 误差 ${leftFmt}，往右到 ${formatNumber(rightWeight)} 误差 ${rightFmt}。右边误差更小，参数往大挪一步变成 ${nextFmt}。`;
      formula = `${rightFmt} < ${curFmt} 成立 → weight 变为 ${nextFmt}`;
      activeLines = [1, 2, 3, 4, 7, 8];
    } else if (action === 'left') {
      title = `第 ${roundNo} 轮：往左更好 → weight - ${stepFmt}`;
      text = `站在 ${wFmt}（误差 ${curFmt}）：往左到 ${formatNumber(leftWeight)} 误差 ${leftFmt}，往右到 ${formatNumber(rightWeight)} 误差 ${rightFmt}。左边误差更小，参数往小挪一步变成 ${nextFmt}。`;
      formula = `${leftFmt} < ${curFmt} 且 ${leftFmt} <= ${rightFmt} → weight 变为 ${nextFmt}`;
      activeLines = [1, 2, 3, 4, 5, 6];
    } else if (Math.abs(currentError) < 1e-6) {
      title = `第 ${roundNo} 轮：两边误差都变大 → 到达谷底并停止`;
      text = `站在 ${wFmt}（误差 ${curFmt}），往左到 ${formatNumber(leftWeight)}（误差 ${leftFmt}）和往右到 ${formatNumber(rightWeight)}（误差 ${rightFmt}）都没有更小，执行 break 结束训练。`;
      formula = `左右误差 (${leftFmt}, ${rightFmt}) 均不小于 ${curFmt} → break`;
      activeLines = [1, 2, 3, 4, 9, 10];
    } else {
      title = `第 ${roundNo} 轮：两边都没更小 → 卡在 ${wFmt} 提前停止`;
      text = `站在 ${wFmt}（误差 ${curFmt}）：往左 ${formatNumber(leftWeight)} 误差 ${leftFmt}（更差），往右 ${formatNumber(rightWeight)} 误差 ${rightFmt}（一样，不更小）。条件都不满足，程序执行 break 停下——谷底 2.5 被步长 ${stepFmt} 跨过去了！`;
      formula = `${leftFmt} < ${curFmt} 为假且 ${rightFmt} < ${curFmt} 为假 → break（停在 ${wFmt}）`;
      activeLines = [1, 2, 3, 4, 9, 10];
    }

    const nextTrail = action === 'stop' ? [...trail] : [...trail, nextWeight];
    steps.push({
      kind: action === 'stop' ? 'stop' : 'move',
      attempt: roundNo,
      title,
      text,
      formula,
      weight,
      prevWeight: weight,
      nextWeight,
      currentError,
      leftWeight,
      leftError,
      rightWeight,
      rightError,
      action,
      trail: nextTrail,
      activeLines,
      prediction: null
    });

    if (action === 'stop') break;
    weight = nextWeight;
    trail.push(nextWeight);
  }

  const finalError = calculateStepError(weight);
  const predictedY = STEP_QUERY_X * weight;
  const exact = Math.abs(finalError) < 1e-6;
  steps.push({
    kind: 'predict',
    attempt: steps.length,
    title: exact
      ? `训练完成：用 weight = ${formatNumber(weight)} 预测输入 4`
      : `训练结束：停在 weight = ${formatNumber(weight)}（存在偏差）`,
    text: exact
      ? `循环结束时学到 weight = ${formatNumber(weight)}，总误差 0.0。代入 predict(4, ${formatNumber(weight)}) 得到 ${formatNumber(predictedY)}。`
      : `因为步长太大（${formatNumber(preset.step)}），参数停在 ${formatNumber(weight)}（总误差仍为 ${formatNumber(finalError)}）。拿它预测输入 4 会得到 ${formatNumber(predictedY)}，比理想值 10.0 偏低 2.0。`,
    formula: `predict(4, ${formatNumber(weight)}) = 4 × ${formatNumber(weight)} = ${formatNumber(predictedY)}`,
    weight,
    prevWeight: weight,
    nextWeight: weight,
    currentError: finalError,
    leftWeight: weight - preset.step,
    leftError: calculateStepError(weight - preset.step),
    rightWeight: weight + preset.step,
    rightError: calculateStepError(weight + preset.step),
    action: 'predict',
    trail: [...trail],
    activeLines: [11],
    prediction: { x: STEP_QUERY_X, y: predictedY, exact }
  });

  return { preset, samples: STEP_SAMPLES, steps };
}
