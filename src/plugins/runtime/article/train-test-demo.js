import { drawRoundedRect, prepareCanvas } from './learning-demo-canvas.js';
import { LearningDemoElement } from './learning-demo-element.js';
import {
  buildTrainTestSteps,
  predictAffine,
  TRAIN_TEST_CODE_LINES,
  TRAIN_TEST_DATASETS
} from './train-test-model.js';

const WIDTH = 440;
const HEIGHT = 356;

function drawTrainTestScene(canvas, scene, stepIndex) {
  const ctx = prepareCanvas(canvas, WIDTH, HEIGHT);
  if (!ctx) return;

  const { dataset, steps } = scene;
  const step = steps[stepIndex];
  const { plot, trainSamples, testSamples } = dataset;

  ctx.fillStyle = '#132334';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const toPx = (x) => plot.left + (x / plot.xMax) * (plot.right - plot.left);
  const toPy = (y) => plot.bottom - (y / plot.yMax) * (plot.bottom - plot.top);

  // Train vs Test region split bands
  const splitX = toPx(2.48);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.fillRect(plot.left, plot.top, splitX - plot.left - 3, plot.bottom - plot.top);

  ctx.save();
  if (!step.testUnlocked) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    ctx.fillRect(splitX + 3, plot.top, plot.right - splitX - 3, plot.bottom - plot.top);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(splitX + 3.5, plot.top + 0.5, plot.right - splitX - 4, plot.bottom - plot.top - 1);
  } else {
    ctx.fillStyle = 'rgba(192, 132, 252, 0.09)';
    ctx.fillRect(splitX + 3, plot.top, plot.right - splitX - 3, plot.bottom - plot.top);
  }
  ctx.restore();

  ctx.font = '700 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7dd3fc';
  ctx.fillText('训练集 (参与调参)', plot.left + 8, plot.top + 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = step.testUnlocked ? '#d8b4fe' : '#94adc4';
  ctx.fillText(step.testUnlocked ? '测试集 (检查效果)' : '测试集 (训练期间封存)', plot.right - 8, plot.top + 16);

  // Grid lines
  ctx.strokeStyle = '#20374e';
  ctx.lineWidth = 1;
  for (let gx = 1; gx <= 4; gx += 1) {
    const x = toPx(gx);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  }
  for (const gy of plot.yTicks) {
    if (gy === 0) continue;
    const y = toPy(gy);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#5f7d99';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top - 4);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right + 4, plot.bottom);
  ctx.stroke();

  ctx.fillStyle = '#94adc4';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let gx = 0; gx <= 4; gx += 1) {
    ctx.fillText(String(gx), toPx(gx), plot.bottom + 14);
  }
  ctx.textAlign = 'right';
  for (const gy of plot.yTicks) {
    ctx.fillText(String(gy), plot.left - 7, toPy(gy) + 4);
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('输出 y（训练集拟合 vs 测试集检验）', plot.left, 18);

  // Active model line
  if (step.weight !== null && step.bias !== null) {
    const endX = step.testUnlocked ? 4.28 : 2.42;
    const clippedX =
      step.weight > 0
        ? Math.min(endX, Math.max(0, (plot.yMax - 0.5 - step.bias) / step.weight))
        : endX;
    const goodTrain = step.trainError === 0;
    ctx.save();
    ctx.strokeStyle = goodTrain ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(toPx(0), toPy(step.bias));
    ctx.lineTo(toPx(clippedX), toPy(predictAffine(clippedX, step.weight, step.bias)));
    ctx.stroke();

    const pillText = `y = ${step.weight} × x + ${step.bias}`;
    ctx.font = '700 12px monospace';
    const pillW = ctx.measureText(pillText).width + 16;
    ctx.fillStyle = goodTrain ? 'rgba(21, 128, 61, 0.30)' : 'rgba(180, 83, 9, 0.30)';
    ctx.strokeStyle = goodTrain ? '#22c55e' : '#f59e0b';
    ctx.lineWidth = 1.2;
    drawRoundedRect(ctx, plot.left + 8, plot.top + 24, pillW, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = goodTrain ? '#4ade80' : '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(pillText, plot.left + 16, plot.top + 39);
    ctx.restore();
  }

  // Draw train points + error bars
  trainSamples.forEach((sample) => {
    const sx = toPx(sample.x);
    const syExp = toPy(sample.expected);

    if (step.weight !== null) {
      const pred = predictAffine(sample.x, step.weight, step.bias);
      const err = Math.abs(pred - sample.expected);
      const syPred = toPy(pred);

      if (err > 1e-6) {
        ctx.save();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, syExp);
        ctx.lineTo(sx, syPred);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sx, syPred, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fb7185';
        ctx.font = '700 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`差${err}`, sx + 7, (syExp + syPred) / 2 + 4);
      } else {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, syExp, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx, syExp, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`(${sample.x},${sample.expected})`, sx - 8, syExp + 4);
  });

  // Draw test points
  testSamples.forEach((sample, idx) => {
    const sx = toPx(sample.x);
    const syExp = toPy(sample.expected);
    const evaluated = idx < step.revealTestCount;

    if (evaluated && step.weight !== null) {
      const pred = predictAffine(sample.x, step.weight, step.bias);
      const err = Math.abs(pred - sample.expected);
      const syPred = toPy(pred);

      if (err > 1e-6) {
        ctx.save();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, syExp);
        ctx.lineTo(sx, syPred);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#132334';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, syPred, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`预测${pred}`, sx - 8, syPred + 4);

        ctx.fillStyle = '#fb7185';
        ctx.font = '700 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`差${err}`, sx - 8, (syExp + syPred) / 2 + 4);
      } else {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(sx, syExp, 9.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.font = '700 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('差0', sx - 12, syExp + 4);
      }
    }

    ctx.save();
    if (!step.testUnlocked) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([3, 2]);
    } else {
      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#ffffff';
    }
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sx, syExp, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = step.testUnlocked ? '#f3e8ff' : '#94adc4';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const labelY = syExp < plot.top + 28 ? syExp + 12 : syExp - 7;
    ctx.fillText(`(${sample.x},${sample.expected})`, sx - 8, labelY);
  });

  // Bottom summary comparison strip
  const barY = 314;
  drawRoundedRect(ctx, 18, barY, 194, 30, 8);
  ctx.fillStyle = step.trainError === 0 ? 'rgba(21, 128, 61, 0.28)' : 'rgba(30, 41, 59, 0.72)';
  ctx.fill();
  ctx.strokeStyle = step.trainError === 0 ? '#22c55e' : '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `训练平均误差: ${step.trainError === null ? '待算' : step.trainError}`,
    18 + 97,
    barY + 19
  );

  drawRoundedRect(ctx, 228, barY, 194, 30, 8);
  const testBad = step.testError !== null && step.testError > 0;
  const testGood = step.testError === 0;
  ctx.fillStyle = testBad
    ? 'rgba(190, 18, 60, 0.28)'
    : testGood
      ? 'rgba(21, 128, 61, 0.28)'
      : 'rgba(30, 41, 59, 0.72)';
  ctx.fill();
  ctx.strokeStyle = testBad ? '#fb7185' : testGood ? '#22c55e' : '#334155';
  ctx.stroke();

  ctx.fillStyle = testBad ? '#fda4af' : testGood ? '#4ade80' : '#cbd5e1';
  ctx.fillText(
    `测试平均误差: ${step.testError === null ? (step.testUnlocked ? '待核对' : '未解封') : step.testError}`,
    228 + 97,
    barY + 19
  );
}

class TrainTestDemo extends LearningDemoElement {
  getDatasets() {
    return TRAIN_TEST_DATASETS;
  }

  getDefaultMode() {
    return 'doubling';
  }

  refreshScene() {
    this.scene = buildTrainTestSteps(this.mode);
    this.steps = this.scene.steps;
  }

  getStepDelay(step) {
    if (step?.kind === 'split' || step?.kind === 'train-lock' || step?.kind === 'summary') return 1150;
    return 860;
  }

  render() {
    this.renderShell({
      ariaLabel: '训练集与测试集对照交互演示',
      dialogTitle: '放大的训练与测试集对照演示',
      eyebrow: 'AGENT STAGE 01 · LESSON 04 / 用测试集检验新输入',
      title: '为什么训练集全对，新输入却可能算错？',
      intro: '点击“▶ 播放演示”观看程序如何先只用训练集调参，再解封测试集逐条核对平均误差。',
      width: WIDTH,
      height: HEIGHT,
      canvasLabel: '训练集拟合曲线与测试集误差对照图',
      legendHtml: `
        <span class="legend-item"><i class="dot dot-sample"></i>训练样例 (参与选参)</span>
        <span class="legend-item"><i class="dot" style="background:#c084fc"></i>测试样例 (仅后验检查)</span>
        <span class="legend-item"><i class="dot dot-line"></i>模型预测线</span>
        <span class="legend-item"><i class="dot dot-error"></i>单条误差</span>
      `,
      varBoxesHtml: `
        <div class="var-chip" data-var-box="phase"><span>当前阶段</span><strong data-var="phase">-</strong></div>
        <div class="var-chip" data-var-box="pair"><span>参数 (w, b)</span><strong data-var="pair">-</strong></div>
        <div class="var-chip" data-var-box="trainError"><span>训练平均误差</span><strong data-var="trainError">-</strong></div>
        <div class="var-chip" data-var-box="testError"><span>测试平均误差</span><strong data-var="testError">-</strong></div>
      `,
      samplesHead: '训练 vs 测试逐条核对',
      noteHtml: '切换上方模式可以对比：当测试集是翻倍规律 (8, 16) 时训练误差 0、测试误差 5.0；当测试集遵循同一条直线 (7, 9) 时两者均为 0.0。',
      codeLines: TRAIN_TEST_CODE_LINES
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
      step.bestWeight !== null && (step.improved || step.kind === 'train-lock') ? 'best' : '';
    this.shadowRoot.querySelector('[data-var-box="trainError"]').dataset.highlight =
      step.trainError === 0 ? 'best' : step.trainError !== null ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="testError"]').dataset.highlight =
      step.testError === 0 ? 'best' : step.testError > 0 ? 'warn' : '';

    const rowsHost = this.shadowRoot.querySelector('[data-sample-rows]');
    if (rowsHost) {
      const renderGroup = (label, rows, locked = false) =>
        rows
          .map((row) => {
            if (locked || row.predicted === null) {
              return `<div class="sample-row"><span>[${label}] (${row.x}, ${row.expected})</span><span>${
                locked ? '训练期不参与计算' : '等待测试'
              }</span><span class="sample-badge">${locked ? '封存' : '待算'}</span></div>`;
            }
            const state = row.error === 0 ? 'zero' : 'error';
            return `<div class="sample-row" data-state="${state}"><span>[${label}] (${row.x}, ${row.expected})</span><span>${row.x}×${step.weight}+${step.bias}=${row.predicted} vs ${row.expected}</span><span class="sample-badge">差 ${row.error}</span></div>`;
          })
          .join('');

      rowsHost.innerHTML =
        renderGroup('训练', step.trainRows, false) +
        renderGroup('测试', step.testRows, !step.testUnlocked);
    }

    drawTrainTestScene(this.shadowRoot.querySelector('[data-canvas="plot"]'), this.scene, this.step);
  }
}

export function registerTrainTestDemo() {
  if (!customElements.get('train-test-demo')) {
    customElements.define('train-test-demo', TrainTestDemo);
  }
}
