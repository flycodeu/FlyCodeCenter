import styles from './learning-demo-shared.css?inline';
import { drawCoordinatePlot, prepareCanvas } from './learning-demo-canvas.js';
import {
  buildStepAdjustSteps,
  calculateStepError,
  formatNumber,
  STEP_CODE_LINES,
  STEP_PRESETS
} from './step-adjust-model.js';

const WIDTH = 440;
const HEIGHT = 434;

const PLOT = {
  left: 48,
  right: 414,
  top: 30,
  bottom: 224,
  xMax: 4.5,
  yMax: 15
};

const VALLEY = {
  dividerY: 242,
  titleY: 262,
  left: 48,
  right: 414,
  top: 282,
  bottom: 396,
  wMin: 0.0,
  wMax: 4.0,
  errMax: 15.5
};

function vx(w) {
  return VALLEY.left + ((w - VALLEY.wMin) / (VALLEY.wMax - VALLEY.wMin)) * (VALLEY.right - VALLEY.left);
}

function vy(err) {
  return VALLEY.bottom - (Math.min(VALLEY.errMax, err) / VALLEY.errMax) * (VALLEY.bottom - VALLEY.top);
}

function drawStepScene(canvas, scene, stepIndex, phase) {
  const ctx = prepareCanvas(canvas, WIDTH, HEIGHT);
  if (!ctx) return;

  const { preset, samples, steps } = scene;
  const step = steps[stepIndex];
  const displayWeight =
    step.kind === 'move' ? step.prevWeight + (step.nextWeight - step.prevWeight) * phase : step.weight;

  ctx.fillStyle = '#132334';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawCoordinatePlot(ctx, {
    plot: PLOT,
    samples,
    yTicks: [0, 5, 10, 15],
    displayWeight,
    errorWeight: step.kind === 'move' && phase < 0.7 ? step.prevWeight : step.nextWeight,
    revealedCount: 3,
    isZeroMatch: Math.abs(calculateStepError(displayWeight, samples)) < 0.05,
    lineEndX: step.kind === 'predict' ? 4.25 : 3.55,
    prediction: step.prediction,
    formatNum: (v) => formatNumber(v, 1)
  });

  // Divider + V-shaped Error Valley
  ctx.strokeStyle = '#243a50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, VALLEY.dividerY);
  ctx.lineTo(WIDTH - 16, VALLEY.dividerY);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`总误差曲线（谷底在 w = 2.5，步长 step = ${formatNumber(preset.step)}）`, 24, VALLEY.titleY);

  // Valley grid & axes
  ctx.strokeStyle = '#20374e';
  ctx.lineWidth = 1;
  for (let wTick = 0; wTick <= 4; wTick += 1) {
    ctx.beginPath();
    ctx.moveTo(vx(wTick), VALLEY.top);
    ctx.lineTo(vx(wTick), VALLEY.bottom);
    ctx.stroke();
  }
  ctx.strokeStyle = '#5f7d99';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(VALLEY.left, VALLEY.top);
  ctx.lineTo(VALLEY.left, VALLEY.bottom);
  ctx.lineTo(VALLEY.right, VALLEY.bottom);
  ctx.stroke();

  ctx.fillStyle = '#94adc4';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  for (let wTick = 0; wTick <= 4; wTick += 1) {
    ctx.fillText(String(wTick), vx(wTick), VALLEY.bottom + 15);
  }
  ctx.textAlign = 'right';
  ctx.fillText('0', VALLEY.left - 7, vy(0) + 4);
  ctx.fillText('6', VALLEY.left - 7, vy(6) + 4);
  ctx.fillText('12', VALLEY.left - 7, vy(12) + 4);
  ctx.fillText('weight', VALLEY.right, VALLEY.bottom + 28);

  // Ideal valley bottom marker (2.5, 0)
  ctx.save();
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(vx(2.5), VALLEY.top);
  ctx.lineTo(vx(2.5), VALLEY.bottom);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#4ade80';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('理想谷底 2.5', vx(2.5), VALLEY.bottom + 28);

  // Draw the V-shaped error curve: (0, 15) -> (2.5, 0) -> (4.0, 9)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(vx(0), vy(calculateStepError(0, samples)));
  ctx.lineTo(vx(2.5), vy(0));
  ctx.lineTo(vx(4.0), vy(calculateStepError(4.0, samples)));
  ctx.stroke();

  // Trail of previously visited weights
  step.trail.forEach((wPos) => {
    const err = calculateStepError(wPos, samples);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.beginPath();
    ctx.arc(vx(wPos), vy(err), 3.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Left and Right probes around step.weight
  if (step.kind === 'move' || step.kind === 'stop') {
    const probes = [
      { side: 'left', w: step.leftWeight, err: step.leftError, label: '左', win: step.action === 'left' },
      { side: 'right', w: step.rightWeight, err: step.rightError, label: '右', win: step.action === 'right' }
    ];
    for (const probe of probes) {
      if (probe.w < VALLEY.wMin || probe.w > VALLEY.wMax) continue;
      const px = vx(probe.w);
      const py = vy(probe.err);
      ctx.save();
      ctx.strokeStyle = probe.win ? '#22c55e' : '#fb7185';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(vx(step.weight), vy(step.currentError));
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#132334';
      ctx.strokeStyle = probe.win ? '#22c55e' : '#fb7185';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = probe.win ? '#4ade80' : '#fda4af';
      ctx.font = '700 11px monospace';
      if (preset.step < 0.4) {
        if (probe.side === 'left') {
          ctx.textAlign = 'right';
          ctx.fillText(`左:${formatNumber(probe.err, 1)}`, px - 8, py + 4);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(`右:${formatNumber(probe.err, 1)}`, px + 8, py + 4);
        }
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(`${probe.label}:${formatNumber(probe.err, 1)}`, px, Math.max(VALLEY.top + 10, py - 9));
      }
    }
  }

  // Current cursor dot
  const curErr = calculateStepError(displayWeight, samples);
  const cx = vx(displayWeight);
  const cy = vy(curErr);
  const atZero = Math.abs(curErr) < 0.05;
  ctx.fillStyle = atZero ? '#22c55e' : '#f59e0b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = atZero ? '#4ade80' : '#fbbf24';
  ctx.font = '700 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`w=${formatNumber(displayWeight, 1)}`, cx, Math.max(VALLEY.top + 10, cy - 13));
}

class StepAdjustDemo extends HTMLElement {
  connectedCallback() {
    if (this.events) return;
    const initialMode = this.getAttribute('mode');
    this.mode = Object.hasOwn(STEP_PRESETS, initialMode) ? initialMode : 'fine';
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
    this.scene = buildStepAdjustSteps(this.mode);
    this.steps = this.scene.steps;
  }

  render() {
    this.refreshScene();
    const { preset } = this.scene;
    const wasExpanded = Boolean(this.shadowRoot.querySelector('dialog')?.open);
    const modeButtons = Object.values(STEP_PRESETS)
      .map(
        (item) =>
          `<button type="button" data-mode="${item.key}" aria-pressed="${item.key === this.mode}"><b>${item.label}</b><code>${item.detail}</code></button>`
      )
      .join('');
    const codeLinesHtml = STEP_CODE_LINES.map((line, idx) => {
      const text = line
        .replace('{INIT}', formatNumber(preset.initialWeight, 1))
        .replace('{STEP}', formatNumber(preset.step, 1));
      return `<span class="code-line" data-line="${idx}">${text}</span>`;
    }).join('');

    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="inline-stage">
        <section class="demo" aria-label="步长自动调参交互演示">
          <header class="heading">
            <button type="button" class="expand" data-action="expand">放大演示 ↗</button>
            <div class="eyebrow">AGENT STAGE 01 · LESSON 02 / 沿误差下坡</div>
            <h3>看程序怎样左右试探、选边移动并决定何时停下</h3>
            <p class="intro">上方看直线如何贴近 2.5 倍样例；下方看参数点怎样沿 V 形误差曲线一步步走向谷底，或因为步长太大跨过谷底。</p>
          </header>
          <div class="mode-picker" role="group" aria-label="切换步长或起点">${modeButtons}</div>
          <div class="stage-grid">
            <div class="canvas-panel">
              <canvas data-canvas="plot" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="预测直线与 V 形误差曲线图"></canvas>
              <div class="canvas-legend" aria-hidden="true">
                <span class="legend-item"><i class="dot dot-sample"></i>样例与误差曲线</span>
                <span class="legend-item"><i class="dot dot-line"></i>当前 weight</span>
                <span class="legend-item"><i class="dot dot-error"></i>左右试探位置</span>
                <span class="legend-item"><i class="dot dot-best"></i>胜出方向 / 谷底</span>
              </div>
            </div>
            <div class="workbench">
              <div>
                <div class="stage-number" data-stage-number></div>
                <strong class="stage-title" data-stage-title></strong>
                <p class="explanation" data-explanation></p>
              </div>
              <div class="formula" data-formula></div>
              <div class="probe-grid" aria-label="左中右三点误差对比">
                <div class="probe-card" data-probe="left"><span>往小 (w-step)</span><strong data-probe-w="left">-</strong><small data-probe-e="left">-</small></div>
                <div class="probe-card" data-probe="cur"><span>当前 (weight)</span><strong data-probe-w="cur">-</strong><small data-probe-e="cur">-</small></div>
                <div class="probe-card" data-probe="right"><span>往大 (w+step)</span><strong data-probe-w="right">-</strong><small data-probe-e="right">-</small></div>
              </div>
              <div class="vars-grid" aria-label="本轮结果变量">
                <div class="var-chip" data-var-box="next"><span>本轮更新后</span><strong data-var="next">-</strong></div>
                <div class="var-chip" data-var-box="step"><span>固定步长 step</span><strong data-var="step">-</strong></div>
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
          <p class="note">对比“精细步长 0.1”与“步子太大 1.0”：当 step = 1.0 时，站在 2.0 处左右试探得到的误差分别是 9.0 和 3.0，程序停在了 2.0，把 2.5 跨了过去。</p>
        </section>
      </div>
      <dialog class="dialog" aria-label="放大的自动调参演示">
        <div class="dialog-header">
          <span>自动小步调参交互演示</span>
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
    const { preset } = this.scene;
    this.dataset.step = String(this.step);
    this.dataset.mode = this.mode;
    this.dataset.playing = String(this.playing);
    this.dataset.weight = formatNumber(step.nextWeight, 2);
    this.dataset.prediction = step.prediction ? formatNumber(step.prediction.y, 2) : '';

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

    this.text('[data-probe-w="left"]', formatNumber(step.leftWeight, 2));
    this.text('[data-probe-e="left"]', `误差 ${formatNumber(step.leftError, 2)}`);
    this.text('[data-probe-w="cur"]', formatNumber(step.weight, 2));
    this.text('[data-probe-e="cur"]', `误差 ${formatNumber(step.currentError, 2)}`);
    this.text('[data-probe-w="right"]', formatNumber(step.rightWeight, 2));
    this.text('[data-probe-e="right"]', `误差 ${formatNumber(step.rightError, 2)}`);

    const leftCard = this.shadowRoot.querySelector('[data-probe="left"]');
    const curCard = this.shadowRoot.querySelector('[data-probe="cur"]');
    const rightCard = this.shadowRoot.querySelector('[data-probe="right"]');
    if (leftCard && curCard && rightCard) {
      leftCard.dataset.selected = step.action === 'left' ? 'win' : '';
      rightCard.dataset.selected = step.action === 'right' ? 'win' : '';
      curCard.dataset.selected =
        step.action === 'stop' ? (Math.abs(step.currentError) < 1e-6 ? 'win' : 'stuck') : 'current';
    }

    this.text('[data-var="next"]', formatNumber(step.nextWeight, 2));
    this.text('[data-var="step"]', formatNumber(preset.step, 2));
    this.shadowRoot.querySelector('[data-var-box="next"]').dataset.highlight =
      step.action === 'left' || step.action === 'right'
        ? 'active'
        : step.kind === 'predict' && step.prediction?.exact
          ? 'best'
          : '';

    this.shadowRoot.querySelectorAll('.code-line').forEach((node) => {
      const idx = Number(node.dataset.line);
      node.dataset.active = String(step.activeLines.includes(idx));
    });

    this.draw();
  }

  draw() {
    const canvas = this.shadowRoot.querySelector('[data-canvas="plot"]');
    const phase = this.reducedMotion.matches ? 1 : this.phase;
    drawStepScene(canvas, this.scene, this.step, phase);
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
      const stepDurationMs = this.steps.length > 8 ? 650 : 1200;
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

export function registerStepAdjustDemo() {
  if (!customElements.get('step-adjust-demo')) {
    customElements.define('step-adjust-demo', StepAdjustDemo);
  }
}
