import styles from './learning-demo-shared.css?inline';
import { drawCoordinatePlot, drawRoundedRect, prepareCanvas } from './learning-demo-canvas.js';
import { buildTwoParamSteps, TWO_PARAM_CODE_LINES, TWO_PARAM_DATASETS } from './two-param-model.js';

const WIDTH = 440;
const HEIGHT = 436;

const PLOT = {
  left: 48,
  right: 414,
  top: 28,
  bottom: 222,
  xMax: 4.5,
  yMax: 16.5
};

const GRID = {
  dividerY: 238,
  titleY: 256,
  left: 72,
  top: 278,
  cellW: 66,
  cellH: 27,
  gap: 3
};

function cellColor(error, maxErr = 24) {
  if (error === 0) return 'rgba(34, 197, 94, 0.34)';
  const ratio = Math.min(1, error / maxErr);
  if (ratio <= 0.16) return 'rgba(245, 158, 11, 0.30)';
  if (ratio <= 0.45) return 'rgba(56, 189, 248, 0.22)';
  return 'rgba(51, 65, 85, 0.48)';
}

function getGridRect(wIdx, bIdx) {
  const x = GRID.left + bIdx * (GRID.cellW + GRID.gap);
  const y = GRID.top + wIdx * (GRID.cellH + GRID.gap);
  return { x, y, w: GRID.cellW, h: GRID.cellH };
}

function drawTwoParamScene(canvas, scene, stepIndex) {
  const ctx = prepareCanvas(canvas, WIDTH, HEIGHT);
  if (!ctx) return;

  const { dataset, steps } = scene;
  const step = steps[stepIndex];

  ctx.fillStyle = '#132334';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawCoordinatePlot(ctx, {
    plot: PLOT,
    samples: dataset.samples,
    yTicks: [0, 4, 8, 12, 16],
    displayWeight: step.weight,
    displayBias: step.bias ?? 0,
    errorWeight: step.weight,
    errorBias: step.bias ?? 0,
    showBias: true,
    revealedCount: step.kind === 'init' ? 0 : 3,
    isZeroMatch: step.kind !== 'init' && step.error === 0,
    lineEndX: step.kind === 'predict' ? 4.25 : 3.55,
    prediction: step.prediction
  });

  // Divider + 5x5 Grid Header
  ctx.strokeStyle = '#243a50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, GRID.dividerY);
  ctx.lineTo(WIDTH - 16, GRID.dividerY);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('25 组组合总误差矩阵（点击任意格子可直达该步）', 24, GRID.titleY);

  // Column headers: bias = 0..4
  ctx.fillStyle = '#94adc4';
  ctx.font = '700 11px monospace';
  ctx.textAlign = 'center';
  dataset.biases.forEach((b, bIdx) => {
    const { x, w } = getGridRect(0, bIdx);
    ctx.fillText(`b=${b}`, x + w / 2, GRID.top - 7);
  });

  // Row headers & 25 cells
  dataset.weights.forEach((wVal, wIdx) => {
    const rowTop = getGridRect(wIdx, 0).y;
    ctx.fillStyle = '#94adc4';
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`w=${wVal}`, GRID.left - 8, rowTop + 17);

    dataset.biases.forEach((bVal, bIdx) => {
      const rect = getGridRect(wIdx, bIdx);
      const key = `${wVal},${bVal}`;
      const tested = Object.hasOwn(step.testedGrid, key);
      const errVal = step.testedGrid[key];
      const isCurrent = step.weight === wVal && step.bias === bVal && step.kind !== 'init';
      const isBest = step.bestWeight === wVal && step.bestBias === bVal;

      ctx.fillStyle = tested ? cellColor(errVal) : '#182b3f';
      drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
      ctx.fill();

      ctx.strokeStyle = isBest ? '#22c55e' : isCurrent ? '#f59e0b' : tested ? '#334e68' : '#243a50';
      ctx.lineWidth = isBest || isCurrent ? 2 : 1;
      drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
      ctx.stroke();

      ctx.fillStyle = !tested ? '#47627d' : isBest ? '#4ade80' : isCurrent ? '#fbbf24' : '#cbd5e1';
      ctx.font = tested ? '700 11px monospace' : '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tested ? (isBest ? `${errVal}★` : String(errVal)) : '·', rect.x + rect.w / 2, rect.y + 17);
    });
  });
}

class TwoParamDemo extends HTMLElement {
  connectedCallback() {
    if (this.events) return;
    const initialMode = this.getAttribute('mode');
    this.mode = Object.hasOwn(TWO_PARAM_DATASETS, initialMode) ? initialMode : 'affine32';
    this.step = 0;
    this.speed = 1;
    this.playing = false;
    this.timer = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.events = new AbortController();
    const { signal } = this.events;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.syncThemeAttribute();
    this.render();

    this.shadowRoot.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.matches('[data-canvas="plot"]')) {
          this.handleCanvasClick(event, target);
          return;
        }

        const button = target.closest('button');
        if (!button) return;
        if (button.dataset.mode) {
          this.pause();
          this.mode = button.dataset.mode;
          this.step = 0;
          this.render();
          this.shadowRoot.querySelector(`[data-mode="${this.mode}"]`)?.focus();
        } else if (button.dataset.action === 'play') {
          this.playing ? this.pause() : this.play();
        } else if (button.dataset.action === 'expand') {
          this.expand();
        } else if (button.dataset.action === 'close') {
          this.shadowRoot.querySelector('dialog')?.close();
        } else if (button.dataset.action === 'next') {
          this.seek(this.step + 1);
        } else if (button.dataset.action === 'previous') {
          this.seek(this.step - 1);
        } else if (button.dataset.action === 'reset') {
          this.seek(0);
        }
      },
      { signal }
    );

    this.shadowRoot.addEventListener(
      'input',
      (event) => {
        if (event.target instanceof Element && event.target.matches('[data-progress]')) {
          this.seek(Number(event.target.value));
        }
      },
      { signal }
    );

    this.shadowRoot.addEventListener(
      'change',
      (event) => {
        if (event.target instanceof Element && event.target.matches('[data-speed]')) {
          this.speed = Number(event.target.value);
        }
      },
      { signal }
    );

    this.shadowRoot.addEventListener(
      'close',
      (event) => {
        if (event.target instanceof Element && event.target.tagName === 'DIALOG') {
          this.collapse();
        }
      },
      { capture: true, signal }
    );

    window.addEventListener('site:theme-change', () => this.syncThemeAttribute(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden && this.playing) this.pause('已暂停：页面暂时不可见。');
      },
      { signal }
    );
    document.addEventListener(
      'astro:before-swap',
      () => {
        this.pause();
        this.shadowRoot?.querySelector('dialog')?.close();
      },
      { signal }
    );

    this.observer = new IntersectionObserver((entries) => {
      if (this.playing && entries.some((entry) => !entry.isIntersecting)) {
        this.pause('已暂停：演示已离开阅读区域。');
      }
    });
    this.observer.observe(this);
    this.dataset.ready = 'true';
  }

  disconnectedCallback() {
    this.pause();
    this.shadowRoot?.querySelector('dialog')?.close();
    this.observer?.disconnect();
    this.events?.abort();
    this.events = null;
    delete this.dataset.ready;
  }

  syncThemeAttribute() {
    const theme = String(document.documentElement.dataset.theme || '').toLowerCase();
    this.dataset.themeMode = theme.includes('dark') ? 'dark' : 'light';
  }

  refreshScene() {
    this.scene = buildTwoParamSteps(this.mode);
    this.steps = this.scene.steps;
  }

  handleCanvasClick(event, canvas) {
    const bounds = canvas.getBoundingClientRect();
    const lx = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const ly = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
    const { weights, biases } = this.scene.dataset;

    for (let wIdx = 0; wIdx < weights.length; wIdx += 1) {
      for (let bIdx = 0; bIdx < biases.length; bIdx += 1) {
        const rect = getGridRect(wIdx, bIdx);
        if (lx >= rect.x && lx <= rect.x + rect.w && ly >= rect.y && ly <= rect.y + rect.h) {
          const targetStep = 1 + wIdx * biases.length + bIdx;
          this.seek(targetStep);
          return;
        }
      }
    }
  }

  render() {
    this.refreshScene();
    const wasExpanded = Boolean(this.shadowRoot.querySelector('dialog')?.open);
    const modeButtons = Object.values(TWO_PARAM_DATASETS)
      .map(
        (ds) =>
          `<button type="button" data-mode="${ds.key}" aria-pressed="${ds.key === this.mode}"><b>${ds.label}</b><code>${ds.samplesLabel}</code></button>`
      )
      .join('');
    const codeLinesHtml = TWO_PARAM_CODE_LINES.map(
      (line, idx) => `<span class="code-line" data-line="${idx}">${line}</span>`
    ).join('');

    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="inline-stage">
        <section class="demo" aria-label="双参数联合搜索交互演示">
          <header class="heading">
            <button type="button" class="expand" data-action="expand">放大演示 ↗</button>
            <div class="eyebrow">AGENT STAGE 01 · LESSON 03 / 双参数联合学习</div>
            <h3>看 weight 和 bias 怎样作为一整组共同决定直线</h3>
            <p class="intro">点击“▶ 播放演示”观看 25 组参数扫描；也可以直接点击下方误差矩阵里的任意格子对比效果。</p>
          </header>
          <div class="mode-picker" role="group" aria-label="切换样例数据集">${modeButtons}</div>
          <div class="stage-grid">
            <div class="canvas-panel">
              <canvas data-canvas="plot" width="${WIDTH}" height="${HEIGHT}" style="cursor:pointer" role="img" aria-label="双参数直线拟合图与 5x5 误差矩阵"></canvas>
              <div class="canvas-legend" aria-hidden="true">
                <span class="legend-item"><i class="dot dot-sample"></i>训练样例点</span>
                <span class="legend-item"><i class="dot dot-line"></i>当前直线与起点 bias</span>
                <span class="legend-item"><i class="dot dot-error"></i>单条误差</span>
                <span class="legend-item"><i class="dot dot-best"></i>最优 (weight, bias)</span>
              </div>
            </div>
            <div class="workbench">
              <div>
                <div class="stage-number" data-stage-number></div>
                <strong class="stage-title" data-stage-title></strong>
                <p class="explanation" data-explanation></p>
              </div>
              <div class="formula" data-formula></div>
              <div class="vars-grid" aria-label="当前与最优参数状态">
                <div class="var-chip" data-var-box="pair"><span>当前 (w, b)</span><strong data-var="pair">-</strong></div>
                <div class="var-chip" data-var-box="error"><span>本组总误差</span><strong data-var="error">-</strong></div>
                <div class="var-chip" data-var-box="bestPair"><span>最优 (w, b)</span><strong data-var="bestPair">None</strong></div>
                <div class="var-chip" data-var-box="bestError"><span>最小误差</span><strong data-var="bestError">None</strong></div>
              </div>
              <div class="samples-box">
                <div class="samples-head" data-samples-head>样例逐条核对</div>
                <div data-sample-rows></div>
              </div>
              <pre class="code-trace" aria-label="当前执行代码行">${codeLinesHtml}</pre>
            </div>
          </div>
          <div class="controls">
            <label class="progress-label"><span>步骤进度</span><span data-progress-label></span></label>
            <input data-progress type="range" min="0" max="${this.steps.length - 1}" value="0" step="1" aria-label="演示步骤" />
            <div class="buttons">
              <button type="button" data-action="previous" aria-label="上一步">上一步</button>
              <button type="button" data-action="play" class="play">▶ 播放演示</button>
              <button type="button" data-action="next" aria-label="下一步">下一步</button>
              <button type="button" data-action="reset" aria-label="从头开始">重置</button>
              <label class="speed">速度
                <select data-speed aria-label="演示速度">
                  <option value="0.5">0.5×</option>
                  <option value="1" selected>1×</option>
                  <option value="2">2×</option>
                </select>
              </label>
            </div>
            <p class="live-status" role="status" aria-live="polite" data-status></p>
          </div>
          <p class="note">weight 控制每一步涨多少（斜率），bias 控制 x = 0 时从哪里起步（截距）。矩阵里每格对应一对 (weight, bias) 的总误差，绿色 ★ 表示目前总误差最小的一组。</p>
        </section>
      </div>
      <dialog class="dialog" aria-label="放大的双参数学习演示">
        <div class="dialog-header">
          <span>双参数学习交互演示</span>
          <button type="button" data-action="close" autofocus>关闭放大演示</button>
        </div>
        <div class="modal-stage"></div>
      </dialog>`;

    this.shadowRoot.querySelector('[data-speed]').value = String(this.speed);
    this.update();
    if (wasExpanded) this.expand();
  }

  text(selector, value) {
    const node = this.shadowRoot.querySelector(selector);
    if (node) node.textContent = value;
  }

  expand() {
    const dialog = this.shadowRoot.querySelector('dialog');
    if (!dialog || dialog.open) return;
    const inline = this.shadowRoot.querySelector('.inline-stage');
    const demo = this.shadowRoot.querySelector('.demo');
    inline.style.minHeight = `${demo.getBoundingClientRect().height}px`;
    this.shadowRoot.querySelector('.modal-stage').appendChild(demo);
    dialog.showModal();
    this.dataset.expanded = 'true';
  }

  collapse() {
    this.pause();
    const inline = this.shadowRoot.querySelector('.inline-stage');
    const demo = this.shadowRoot.querySelector('.demo');
    if (inline && demo) inline.appendChild(demo);
    if (inline) inline.style.minHeight = '';
    this.dataset.expanded = 'false';
    if (this.isConnected) {
      this.shadowRoot.querySelector('[data-action="expand"]')?.focus({ preventScroll: true });
    }
  }

  update() {
    const step = this.steps[this.step];
    this.dataset.step = String(this.step);
    this.dataset.mode = this.mode;
    this.dataset.playing = String(this.playing);
    this.dataset.bestWeight = step.bestWeight === null ? '' : String(step.bestWeight);
    this.dataset.bestBias = step.bestBias === null ? '' : String(step.bestBias);
    this.dataset.prediction = step.prediction ? String(step.prediction.y) : '';

    this.text('[data-stage-number]', `STEP ${String(this.step + 1).padStart(2, '0')} / ${this.steps.length}`);
    this.text('[data-stage-title]', step.title);
    this.text('[data-explanation]', step.text);
    this.text('[data-formula]', step.formula);
    this.text('[data-progress-label]', `${this.step + 1} / ${this.steps.length}`);
    this.text('[data-status]', step.title);

    const range = this.shadowRoot.querySelector('[data-progress]');
    if (range) {
      range.value = String(this.step);
      range.setAttribute('aria-valuetext', step.title);
    }

    this.shadowRoot.querySelector('[data-action="previous"]').disabled = this.step === 0;
    this.shadowRoot.querySelector('[data-action="next"]').disabled = this.step === this.steps.length - 1;
    this.text(
      '[data-action="play"]',
      this.playing ? 'Ⅱ 暂停' : this.step === this.steps.length - 1 ? '↻ 再看一次' : '▶ 播放演示'
    );

    this.text('[data-var="pair"]', step.weight === null ? '未选' : `(${step.weight}, ${step.bias})`);
    this.text('[data-var="error"]', step.error === null ? '未算' : String(step.error));
    this.text('[data-var="bestPair"]', step.bestWeight === null ? 'None' : `(${step.bestWeight}, ${step.bestBias})`);
    this.text('[data-var="bestError"]', step.bestError === null ? 'None' : String(step.bestError));

    this.shadowRoot.querySelector('[data-var-box="pair"]').dataset.highlight = step.kind === 'pair' ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="error"]').dataset.highlight = step.kind === 'pair' ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="bestPair"]').dataset.highlight =
      step.bestWeight !== null && (step.improved || step.kind === 'predict') ? 'best' : '';
    this.shadowRoot.querySelector('[data-var-box="bestError"]').dataset.highlight =
      step.bestError !== null && (step.improved || step.kind === 'predict') ? 'best' : '';

    const rowsHost = this.shadowRoot.querySelector('[data-sample-rows]');
    if (rowsHost) {
      if (step.kind === 'predict' && step.prediction) {
        this.text('[data-samples-head]', '训练完成 → 新输入推理');
        rowsHost.innerHTML = `<div class="sample-row" data-state="zero">
          <span>x=${step.prediction.x}</span>
          <span>${step.prediction.x}×${step.bestWeight}+${step.bestBias} = ${step.prediction.y}</span>
          <span class="sample-badge">新预测</span>
        </div>`;
      } else {
        this.text('[data-samples-head]', '样例逐条核对（x × weight + bias vs 答案）');
        rowsHost.innerHTML = step.rows
          .map((row) => {
            if (row.predicted === null) {
              return `<div class="sample-row"><span>(${row.x}, ${row.expected})</span><span>等待代入 (w, b)</span><span class="sample-badge">待算</span></div>`;
            }
            const state = row.error === 0 ? 'zero' : 'error';
            return `<div class="sample-row" data-state="${state}"><span>(${row.x}, ${row.expected})</span><span>${row.x}×${step.weight}+${step.bias}=${row.predicted} vs ${row.expected}</span><span class="sample-badge">差 ${row.error}</span></div>`;
          })
          .join('');
      }
    }

    this.shadowRoot.querySelectorAll('.code-line').forEach((node) => {
      const idx = Number(node.dataset.line);
      node.dataset.active = String(step.activeLines.includes(idx));
    });

    drawTwoParamScene(this.shadowRoot.querySelector('[data-canvas="plot"]'), this.scene, this.step);
  }

  seek(nextStep) {
    this.pause();
    this.step = Math.max(0, Math.min(this.steps.length - 1, nextStep));
    this.update();
  }

  play() {
    if (this.playing) return;
    if (this.step === this.steps.length - 1) {
      this.step = 0;
      this.update();
    }
    this.playing = true;
    this.update();

    const scheduleNext = () => {
      if (!this.playing || !this.isConnected) return;
      const cur = this.steps[this.step];
      const baseMs = cur?.improved || cur?.kind === 'init' ? 580 : 250;
      const delay = this.reducedMotion.matches ? 420 / this.speed : baseMs / this.speed;
      this.timer = window.setTimeout(() => {
        if (!this.playing || !this.isConnected) return;
        this.step += 1;
        if (this.step >= this.steps.length - 1) {
          this.step = this.steps.length - 1;
          this.pause();
          this.update();
          return;
        }
        this.update();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  pause(message) {
    this.playing = false;
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.dataset.playing = 'false';
    const play = this.shadowRoot?.querySelector('[data-action="play"]');
    if (play) {
      play.textContent = this.step === this.steps.length - 1 ? '↻ 再看一次' : '▶ 播放演示';
    }
    if (message && this.shadowRoot) {
      this.text('[data-status]', message);
    }
  }
}

export function registerTwoParamDemo() {
  if (!customElements.get('two-param-demo')) {
    customElements.define('two-param-demo', TwoParamDemo);
  }
}
