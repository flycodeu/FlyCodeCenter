import { drawRoundedRect, prepareCanvas } from './learning-demo-canvas.js';
import { LearningDemoElement } from './learning-demo-element.js';
import {
  buildFeatureTransformSteps,
  FEATURE_TRANSFORM_CODE_LINES,
  FEATURE_TRANSFORM_DATASETS,
  predictTransformed,
  transformInput
} from './feature-transform-model.js';

const WIDTH = 440;
const HEIGHT = 432;

const RAW_PLOT = { left: 52, right: 414, top: 26, bottom: 186 };
const TRANS_PLOT = { left: 52, right: 414, top: 238, bottom: 396 };

function drawFeatureTransformScene(canvas, scene, stepIndex) {
  const ctx = prepareCanvas(canvas, WIDTH, HEIGHT);
  if (!ctx) return;

  const { dataset, steps } = scene;
  const step = steps[stepIndex];
  const { trainSamples, testSamples, xMax, uMax, yMax, yTicks } = dataset;

  ctx.fillStyle = '#132334';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- TOP PANEL: Raw Input x -> y ---
  const toRawX = (x) => RAW_PLOT.left + (x / xMax) * (RAW_PLOT.right - RAW_PLOT.left);
  const toRawY = (y) => RAW_PLOT.bottom - (y / yMax) * (RAW_PLOT.bottom - RAW_PLOT.top);

  ctx.strokeStyle = '#20374e';
  ctx.lineWidth = 1;
  for (let gx = 1; gx <= 6; gx += 1) {
    const px = toRawX(gx);
    ctx.beginPath();
    ctx.moveTo(px, RAW_PLOT.top);
    ctx.lineTo(px, RAW_PLOT.bottom);
    ctx.stroke();
  }
  for (const gy of yTicks) {
    if (gy === 0) continue;
    const py = toRawY(gy);
    ctx.beginPath();
    ctx.moveTo(RAW_PLOT.left, py);
    ctx.lineTo(RAW_PLOT.right, py);
    ctx.stroke();
  }

  ctx.strokeStyle = '#5f7d99';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(RAW_PLOT.left, RAW_PLOT.top - 4);
  ctx.lineTo(RAW_PLOT.left, RAW_PLOT.bottom);
  ctx.lineTo(RAW_PLOT.right + 4, RAW_PLOT.bottom);
  ctx.stroke();

  ctx.fillStyle = '#94adc4';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (let gx = 0; gx <= 6; gx += 1) {
    ctx.fillText(String(gx), toRawX(gx), RAW_PLOT.bottom + 13);
  }
  ctx.textAlign = 'right';
  for (const gy of yTicks) {
    ctx.fillText(String(gy), RAW_PLOT.left - 7, toRawY(gy) + 3);
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1. 原始输入空间：x (1..6) vs 答案 y（弯曲上升）', RAW_PLOT.left, 16);

  // Draw exponential model curve on raw space once weight is active
  if (step.weight !== null) {
    const endX = step.testUnlocked ? 6.12 : 4.25;
    const isPerfect = step.trainError === 0;
    ctx.save();
    ctx.strokeStyle = isPerfect ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let started = false;
    for (let x = 0; x <= endX; x += 0.1) {
      const y = predictTransformed(x, step.weight, step.bias);
      if (y > yMax + 2) break;
      const px = toRawX(x);
      const py = toRawY(y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Raw points
  const allRaw = [
    ...trainSamples.map((s) => ({ ...s, isTest: false, visible: true })),
    ...testSamples.map((s, idx) => ({
      ...s,
      isTest: true,
      visible: step.testUnlocked || idx < step.revealTestCount
    }))
  ];
  allRaw.forEach((sample, idx) => {
    const sx = toRawX(sample.x);
    const sy = toRawY(sample.expected);
    ctx.save();
    if (sample.isTest && !step.testUnlocked) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([3, 2]);
    } else if (sample.isTest) {
      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
    }
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Cleanly stagger low labels so points never collide
    ctx.fillStyle = sample.isTest ? (step.testUnlocked ? '#f3e8ff' : '#94adc4') : '#e2e8f0';
    ctx.font = '10px monospace';
    if (sample.x <= 2) {
      ctx.textAlign = 'center';
      ctx.fillText(`(${sample.x},${sample.expected})`, sx, sy - 9 - (idx % 2) * 8);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(`(${sample.x},${sample.expected})`, sx - 7, sy + 3);
    }
  });

  // --- DIVIDER ---
  ctx.strokeStyle = '#243a50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, 208);
  ctx.lineTo(WIDTH - 16, 208);
  ctx.stroke();

  // --- BOTTOM PANEL: Transformed Input u = 2^x -> y ---
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('2. 变换后空间：u = 2 ** x vs 答案 y', TRANS_PLOT.left, 226);

  ctx.fillStyle = step.testError === 0 ? '#4ade80' : '#94adc4';
  ctx.font = '700 11px monospace';
  ctx.textAlign = 'right';
  const headerStatus =
    step.testError !== null
      ? `train=${step.trainError} · test=${step.testError}`
      : step.trainError !== null
        ? `train=${step.trainError}`
        : step.showTransformedSpace
          ? '点已对齐成直线'
          : '';
  if (headerStatus) {
    ctx.fillText(headerStatus, TRANS_PLOT.right, 226);
  }

  if (!step.showTransformedSpace) {
    drawRoundedRect(
      ctx,
      TRANS_PLOT.left,
      TRANS_PLOT.top,
      TRANS_PLOT.right - TRANS_PLOT.left,
      TRANS_PLOT.bottom - TRANS_PLOT.top,
      10
    );
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#94adc4';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '点击“下一步”观察：计算 2 ** x 如何把曲线点拉直',
      (TRANS_PLOT.left + TRANS_PLOT.right) / 2,
      (TRANS_PLOT.top + TRANS_PLOT.bottom) / 2 + 4
    );
    return;
  }

  const toUX = (u) => TRANS_PLOT.left + (u / uMax) * (TRANS_PLOT.right - TRANS_PLOT.left);
  const toUY = (y) => TRANS_PLOT.bottom - (y / yMax) * (TRANS_PLOT.bottom - TRANS_PLOT.top);
  const uTicks = [0, 16, 32, 48, 64];

  ctx.strokeStyle = '#20374e';
  ctx.lineWidth = 1;
  for (const gu of uTicks) {
    if (gu === 0) continue;
    const px = toUX(gu);
    ctx.beginPath();
    ctx.moveTo(px, TRANS_PLOT.top);
    ctx.lineTo(px, TRANS_PLOT.bottom);
    ctx.stroke();
  }
  for (const gy of yTicks) {
    if (gy === 0) continue;
    const py = toUY(gy);
    ctx.beginPath();
    ctx.moveTo(TRANS_PLOT.left, py);
    ctx.lineTo(TRANS_PLOT.right, py);
    ctx.stroke();
  }

  ctx.strokeStyle = '#5f7d99';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(TRANS_PLOT.left, TRANS_PLOT.top - 4);
  ctx.lineTo(TRANS_PLOT.left, TRANS_PLOT.bottom);
  ctx.lineTo(TRANS_PLOT.right + 4, TRANS_PLOT.bottom);
  ctx.stroke();

  ctx.fillStyle = '#94adc4';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  for (const gu of uTicks) {
    ctx.fillText(String(gu), toUX(gu), TRANS_PLOT.bottom + 13);
  }
  ctx.textAlign = 'right';
  for (const gy of yTicks) {
    ctx.fillText(String(gy), TRANS_PLOT.left - 7, toUY(gy) + 3);
  }

  // Straight line y = u * weight + bias in transformed space
  if (step.weight !== null) {
    const endU = step.testUnlocked ? 66 : 19;
    const clippedU =
      step.weight > 0 ? Math.min(endU, Math.max(0, (yMax - 2 - step.bias) / step.weight)) : endU;
    const isPerfect = step.trainError === 0;
    ctx.save();
    ctx.strokeStyle = isPerfect ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(toUX(0), toUY(step.bias));
    ctx.lineTo(toUX(clippedU), toUY(clippedU * step.weight + step.bias));
    ctx.stroke();

    const pillText = `y = u × ${step.weight} + ${step.bias}`;
    ctx.font = '700 11px monospace';
    const pillW = ctx.measureText(pillText).width + 14;
    ctx.fillStyle = isPerfect ? 'rgba(21, 128, 61, 0.30)' : 'rgba(180, 83, 9, 0.30)';
    ctx.strokeStyle = isPerfect ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, TRANS_PLOT.left + 8, TRANS_PLOT.top + 4, pillW, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isPerfect ? '#4ade80' : '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(pillText, TRANS_PLOT.left + 15, TRANS_PLOT.top + 17);
    ctx.restore();
  }

  // Points in transformed u = 2**x space
  allRaw.forEach((sample) => {
    const u = transformInput(sample.x);
    const sx = toUX(u);
    const sy = toUY(sample.expected);

    ctx.save();
    if (sample.isTest && !step.testUnlocked) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([3, 2]);
    } else if (sample.isTest) {
      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
    }
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (sample.x >= 4 || sample.x === 1) {
      ctx.fillStyle = sample.isTest ? (step.testUnlocked ? '#f3e8ff' : '#94adc4') : '#e2e8f0';
      ctx.font = '10px monospace';
      ctx.textAlign = sample.x === 1 ? 'left' : 'right';
      const uyOffset = sy < TRANS_PLOT.top + 22 ? sy + 12 : sy - 6;
      ctx.fillText(
        `(${u},${sample.expected})`,
        sample.x === 1 ? sx + 7 : sx - 7,
        uyOffset
      );
    }
  });
}

class FeatureTransformDemo extends LearningDemoElement {
  getDatasets() {
    return FEATURE_TRANSFORM_DATASETS;
  }

  getDefaultMode() {
    return 'exp_basic';
  }

  refreshScene() {
    this.scene = buildFeatureTransformSteps(this.mode);
    this.steps = this.scene.steps;
  }

  getStepDelay(step) {
    if (step?.kind === 'init' || step?.kind === 'transform' || step?.kind === 'summary') return 1150;
    return 860;
  }

  render() {
    this.renderShell({
      ariaLabel: '特征变换与模型结构交互演示',
      dialogTitle: '放大的输入变换与直线化演示',
      eyebrow: 'AGENT STAGE 01 · LESSON 05 / 先变换输入，再训练参数',
      title: '把 2 ** x 放进 predict()：曲线瞬间变成直线',
      intro: '点击“▶ 播放演示”对比上下两张图：只要先算出 u = 2 ** x，原本的翻倍规律就能用同样的搜索方法一击命中。',
      width: WIDTH,
      height: HEIGHT,
      canvasLabel: '原始输入空间与变换后特征空间对比图',
      legendHtml: `
        <span class="legend-item"><i class="dot dot-sample"></i>训练点 x=1..4</span>
        <span class="legend-item"><i class="dot" style="background:#c084fc"></i>测试点 x=5,6</span>
        <span class="legend-item"><i class="dot dot-best"></i>(2^x)×w + b 曲线与直线</span>
      `,
      varBoxesHtml: `
        <div class="var-chip" data-var-box="phase"><span>当前环节</span><strong data-var="phase">-</strong></div>
        <div class="var-chip" data-var-box="pair"><span>参数 (w, b)</span><strong data-var="pair">-</strong></div>
        <div class="var-chip" data-var-box="trainError"><span>训练平均误差</span><strong data-var="trainError">-</strong></div>
        <div class="var-chip" data-var-box="testError"><span>测试平均误差</span><strong data-var="testError">-</strong></div>
      `,
      samplesHead: '变换 u = 2 ** x 后逐条核对',
      noteHtml: '人负责设计 2 ** x 的模型结构，程序只负责找 weight 和 bias。切换练习组 (3×2^x + 1)，同一套训练循环立刻学会 (3, 1)。',
      codeLines: FEATURE_TRANSFORM_CODE_LINES
    });
  }

  update() {
    const step = this.steps[this.step];
    this.updateCommon(step);
    this.dataset.bestWeight = step.bestWeight === null ? '' : String(step.bestWeight);
    this.dataset.bestBias = step.bestBias === null ? '' : String(step.bestBias);
    this.dataset.trainError = step.trainError === null ? '' : String(step.trainError);
    this.dataset.testError = step.testError === null ? '' : String(step.testError);

    this.text('[data-var="phase"]', step.phase);
    this.text('[data-var="pair"]', step.weight === null ? '未选' : `(${step.weight}, ${step.bias})`);
    this.text('[data-var="trainError"]', step.trainError === null ? '未算' : String(step.trainError));
    this.text(
      '[data-var="testError"]',
      step.testError === null ? (step.testUnlocked ? '待检' : '未解封') : String(step.testError)
    );

    this.shadowRoot.querySelector('[data-var-box="phase"]').dataset.highlight = 'active';
    this.shadowRoot.querySelector('[data-var-box="pair"]').dataset.highlight =
      step.bestWeight !== null && (step.improved || step.kind === 'train-lock' || step.kind === 'summary') ? 'best' : '';
    this.shadowRoot.querySelector('[data-var-box="trainError"]').dataset.highlight =
      step.trainError === 0 ? 'best' : step.trainError !== null ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="testError"]').dataset.highlight =
      step.testError === 0 ? 'best' : '';

    const rowsHost = this.shadowRoot.querySelector('[data-sample-rows]');
    if (rowsHost) {
      const renderRow = (label, row, locked = false) => {
        if (locked) {
          return `<div class="sample-row"><span>[${label}] x=${row.x} (答案 ${row.expected})</span><span>等待训练完成后验</span><span class="sample-badge">封存</span></div>`;
        }
        if (row.predicted === null) {
          return `<div class="sample-row"><span>[${label}] x=${row.x} → u=${row.u}</span><span>${
            step.showTransformedSpace ? `变换得 u=${row.u}，目标 ${row.expected}` : `原始 (${row.x}, ${row.expected})`
          }</span><span class="sample-badge">${step.showTransformedSpace ? '已变换' : '原始'}</span></div>`;
        }
        const state = row.error === 0 ? 'zero' : 'error';
        return `<div class="sample-row" data-state="${state}"><span>[${label}] x=${row.x}→u=${row.u}</span><span>${row.u}×${step.weight}+${step.bias}=${row.predicted} vs ${row.expected}</span><span class="sample-badge">差 ${row.error}</span></div>`;
      };

      rowsHost.innerHTML =
        step.trainRows.map((r) => renderRow('训练', r, false)).join('') +
        step.testRows.map((r) => renderRow('测试', r, !step.testUnlocked)).join('');
    }

    drawFeatureTransformScene(this.shadowRoot.querySelector('[data-canvas="plot"]'), this.scene, this.step);
  }
}

export function registerFeatureTransformDemo() {
  if (!customElements.get('feature-transform-demo')) {
    customElements.define('feature-transform-demo', FeatureTransformDemo);
  }
}
