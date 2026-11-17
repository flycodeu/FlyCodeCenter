import styles from './learning-demo-shared.css?inline';
import { drawCoordinatePlot, drawRoundedRect, prepareCanvas } from './learning-demo-canvas.js';
import { buildLessonSteps, CODE_LINES, DATASETS } from './param-learning-model.js';

const WIDTH = 440;
const HEIGHT = 422;

const PLOT = {
  left: 48,
  right: 414,
  top: 32,
  bottom: 254,
  xMax: 4.5,
  yMax: 17
};

const BARS = {
  dividerY: 270,
  titleY: 289,
  top: 326,
  bottom: 392,
  maxError: 12,
  centers: [100, 187, 274, 361],
  width: 52
};

function drawScene(canvas, scene, stepIndex, phase) {
  const ctx = prepareCanvas(canvas, WIDTH, HEIGHT);
  if (!ctx) return;

  const { dataset, steps } = scene;
  const step = steps[stepIndex];

  ctx.fillStyle = '#132334';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const lineT = step.kind === 'evaluate' ? Math.min(1, phase / 0.28) : 1;
  const displayWeight =
    step.activeWeight === null
      ? null
      : step.prevWeight + (step.activeWeight - step.prevWeight) * lineT;
  const revealedCount =
    step.kind === 'evaluate'
      ? phase < 0.28
        ? 0
        : phase < 0.52
          ? 1
          : phase < 0.76
            ? 2
            : 3
      : step.kind === 'init'
        ? 0
        : 3;

  drawCoordinatePlot(ctx, {
    plot: PLOT,
    samples: dataset.samples,
    yTicks: [0, 4, 8, 12, 16],
    displayWeight,
    errorWeight: step.activeWeight,
    revealedCount,
    isZeroMatch: step.kind !== 'init' && step.totalError === 0,
    lineEndX: step.kind === 'predict' ? 4.25 : 3.55,
    prediction: step.prediction,
    formatNum: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  });

  // Divider + Error Bar Chart
  ctx.strokeStyle = '#243a50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, BARS.dividerY);
  ctx.lineTo(WIDTH - 16, BARS.dividerY);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('候选参数总误差对比（越小越好）', 24, BARS.titleY);

  ctx.strokeStyle = '#47627d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(40, BARS.bottom);
  ctx.lineTo(WIDTH - 28, BARS.bottom);
  ctx.stroke();

  dataset.candidates.forEach((candidate, idx) => {
    const cx = BARS.centers[idx];
    const x = cx - BARS.width / 2;
    const tested = Object.hasOwn(step.testedErrors, candidate);
    const isCurrentEvaluate = step.kind === 'evaluate' && step.activeWeight === candidate;
    const showBar = tested && (!isCurrentEvaluate || phase >= 0.76);
    const errVal = step.testedErrors[candidate];
    const isBest = step.bestWeight === candidate;
    const isActive = step.activeWeight === candidate;

    if (showBar) {
      const barH = errVal === 0 ? 7 : Math.max(10, (errVal / BARS.maxError) * (BARS.bottom - BARS.top));
      const barY = BARS.bottom - barH;
      ctx.fillStyle = isBest ? '#22c55e' : isActive ? '#f59e0b' : '#475569';
      drawRoundedRect(ctx, x, barY, BARS.width, barH, 5);
      ctx.fill();

      ctx.fillStyle = isBest ? '#4ade80' : isActive ? '#fbbf24' : '#cbd5e1';
      ctx.font = '700 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isBest ? `${errVal} ★最优` : `误差 ${errVal}`, cx, barY - 7);
    } else {
      ctx.save();
      ctx.strokeStyle = '#334e68';
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x, BARS.bottom - 24, BARS.width, 24);
      ctx.restore();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isCurrentEvaluate ? '计算中' : '待试', cx, BARS.bottom - 8);
    }

    ctx.fillStyle = isBest ? '#4ade80' : isActive ? '#fbbf24' : '#94adc4';
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`w = ${candidate}`, cx, BARS.bottom + 16);
  });
}

class ParamLearningDemo extends HTMLElement {
  connectedCallback() {
    if (this.events) return;
    const initialMode = this.getAttribute('mode');
    this.mode = Object.hasOwn(DATASETS, initialMode) ? initialMode : 'double';
    this.step = 0;
    this.phase = 1;
    this.speed = 1;
    this.playing = false;
    this.raf = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.events = new AbortController();
    const { signal } = this.events;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.syncThemeAttribute();
    this.render();

    this.shadowRoot.addEventListener(
      'click',
      (event) => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (!button) return;
        if (button.dataset.mode) {
          this.pause();
          this.mode = button.dataset.mode;
          this.step = 0;
          this.phase = 1;
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
    this.scene = buildLessonSteps(this.mode);
    this.steps = this.scene.steps;
  }

  render() {
    this.refreshScene();
    const wasExpanded = Boolean(this.shadowRoot.querySelector('dialog')?.open);
    const modeButtons = Object.values(DATASETS)
      .map(
        (ds) =>
          `<button type="button" data-mode="${ds.key}" aria-pressed="${ds.key === this.mode}"><b>${ds.label}</b><code>${ds.samplesLabel}</code></button>`
      )
      .join('');
    const codeLinesHtml = CODE_LINES.map(
      (line, idx) => `<span class="code-line" data-line="${idx}">${line}</span>`
    ).join('');

    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="inline-stage">
        <section class="demo" aria-label="参数学习过程交互演示">
          <header class="heading">
            <button type="button" class="expand" data-action="expand">放大演示 ↗</button>
            <div class="eyebrow">AGENT STAGE 01 / 参数自己学出来</div>
            <h3>看程序怎样逐个尝试、比较误差并锁定参数</h3>
            <p class="intro">点击“下一步”慢慢看每一行代码在做什么，或点击“▶ 播放演示”连续观看整轮训练与预测。</p>
          </header>
          <div class="mode-picker" role="group" aria-label="切换样例数据集">${modeButtons}</div>
          <div class="stage-grid">
            <div class="canvas-panel">
              <canvas data-canvas="plot" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="样例点、候选直线与总误差对比图"></canvas>
              <div class="canvas-legend" aria-hidden="true">
                <span class="legend-item"><i class="dot dot-sample"></i>训练样例点</span>
                <span class="legend-item"><i class="dot dot-line"></i>当前尝试的直线</span>
                <span class="legend-item"><i class="dot dot-error"></i>单条误差 |预测−答案|</span>
                <span class="legend-item"><i class="dot dot-best"></i>最优参数 / 预测结果</span>
              </div>
            </div>
            <div class="workbench">
              <div>
                <div class="stage-number" data-stage-number></div>
                <strong class="stage-title" data-stage-title></strong>
                <p class="explanation" data-explanation></p>
              </div>
              <div class="formula" data-formula></div>
              <div class="vars-grid" aria-label="当前变量状态">
                <div class="var-chip" data-var-box="weight"><span>weight</span><strong data-var="weight">-</strong></div>
                <div class="var-chip" data-var-box="totalError"><span>total_error</span><strong data-var="totalError">-</strong></div>
                <div class="var-chip" data-var-box="bestWeight"><span>best_weight</span><strong data-var="bestWeight">None</strong></div>
                <div class="var-chip" data-var-box="bestError"><span>best_error</span><strong data-var="bestError">None</strong></div>
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
          <p class="note">本演示直接执行第 1 课中的逐个枚举逻辑：固定公式 predict(x, weight) = x * weight，按候选列表 [1, 2, 3, 4] 计算绝对误差总和并保留最小误差参数。</p>
        </section>
      </div>
      <dialog class="dialog" aria-label="放大的参数学习演示">
        <div class="dialog-header">
          <span>参数学习交互演示</span>
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

    this.text('[data-var="weight"]', step.activeWeight === null ? '未选' : String(step.activeWeight));
    this.text('[data-var="totalError"]', step.totalError === null ? '未算' : String(step.totalError));
    this.text('[data-var="bestWeight"]', step.bestWeight === null ? 'None' : String(step.bestWeight));
    this.text('[data-var="bestError"]', step.bestError === null ? 'None' : String(step.bestError));

    this.shadowRoot.querySelector('[data-var-box="weight"]').dataset.highlight =
      step.kind === 'evaluate' ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="totalError"]').dataset.highlight =
      step.kind === 'evaluate' ? 'active' : '';
    this.shadowRoot.querySelector('[data-var-box="bestWeight"]').dataset.highlight =
      step.bestWeight !== null && (step.improved || step.kind === 'predict') ? 'best' : '';
    this.shadowRoot.querySelector('[data-var-box="bestError"]').dataset.highlight =
      step.bestError !== null && (step.improved || step.kind === 'predict') ? 'best' : '';

    const rowsHost = this.shadowRoot.querySelector('[data-sample-rows]');
    if (rowsHost) {
      if (step.kind === 'predict' && step.prediction) {
        this.text('[data-samples-head]', '训练完成 → 新输入推理');
        rowsHost.innerHTML = `<div class="sample-row" data-state="zero">
          <span>x=${step.prediction.x}</span>
          <span>predict(${step.prediction.x}, ${step.bestWeight}) = ${step.prediction.y}</span>
          <span class="sample-badge">新预测</span>
        </div>`;
      } else {
        this.text('[data-samples-head]', '样例逐条核对（x × weight vs 正确答案）');
        rowsHost.innerHTML = step.currentRows
          .map((row) => {
            if (row.predicted === null) {
              return `<div class="sample-row"><span>(${row.x}, ${row.expected})</span><span>等待代入 weight</span><span class="sample-badge">待算</span></div>`;
            }
            const state = row.error === 0 ? 'zero' : 'error';
            return `<div class="sample-row" data-state="${state}"><span>(${row.x}, ${row.expected})</span><span>${row.x}×${step.activeWeight}=${row.predicted} vs ${row.expected}</span><span class="sample-badge">差 ${row.error}</span></div>`;
          })
          .join('');
      }
    }

    this.shadowRoot.querySelectorAll('.code-line').forEach((node) => {
      const idx = Number(node.dataset.line);
      node.dataset.active = String(step.activeLines.includes(idx));
    });

    this.draw();
  }

  draw() {
    const canvas = this.shadowRoot.querySelector('[data-canvas="plot"]');
    const phase = this.reducedMotion.matches ? 1 : this.phase;
    drawScene(canvas, this.scene, this.step, phase);
  }

  seek(nextStep) {
    this.pause();
    this.step = Math.max(0, Math.min(this.steps.length - 1, nextStep));
    this.phase = 1;
    this.update();
  }

  play() {
    if (this.playing) return;
    if (this.step === this.steps.length - 1) {
      this.step = 0;
      this.phase = 0;
    } else if (this.phase >= 1) {
      this.phase = 0;
    }
    this.playing = true;
    this.lastTime = performance.now();
    this.update();

    const tick = (now) => {
      if (!this.playing || !this.isConnected) return;
      const stepDurationMs = this.steps[this.step]?.kind === 'evaluate' ? 2300 : 1400;
      this.phase = Math.min(1, this.phase + ((now - this.lastTime) / stepDurationMs) * this.speed);
      this.lastTime = now;
      if (this.phase >= 1) {
        this.step += 1;
        this.phase = 0;
        if (this.step >= this.steps.length - 1) {
          this.step = this.steps.length - 1;
          this.phase = 1;
          this.pause();
          this.update();
          return;
        }
        this.update();
      } else {
        this.draw();
      }
      this.raf = requestAnimationFrame(tick);
    };

    this.raf = requestAnimationFrame(tick);
  }

  pause(message) {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
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

export function registerParamLearningDemo() {
  if (!customElements.get('param-learning-demo')) {
    customElements.define('param-learning-demo', ParamLearningDemo);
  }
}
