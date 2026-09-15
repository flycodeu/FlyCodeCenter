import styles from './video-coding-demo.css?inline';
import { BACKGROUND, BLOCK, COLS, ROWS, createPrediction, ORDER_FRAMES, ORDER_STEPS } from './video-coding-model.js';

const WIDTH = 264;
const HEIGHT = 184;
const CELL = 20;
const PAD = 12;
const TYPES = {
  I: { label: '本幅画面内', premise: 'I：从本幅画面已经重建的邻近像素取得依据，不借用其他帧。', reference: '同一画面的邻近像素' },
  P: { label: '借用参考画面', premise: 'P：当前原画面已拍到。编码器在已重建的参考画面中寻找相似块，并记录取样位置。', reference: '已重建的参考画面' },
  B: { label: '组合两个参考', premise: 'B：本例把两幅参考中的小球分别移到当前位置，再组合成预测。两幅参考都必须先解码。', reference: '两幅已重建的参考' }
};

function drawFrame(canvas, pixels, options = {}) {
  if (!canvas) return;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const w = WIDTH * scale;
  const h = HEIGHT * scale;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#162b3e';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (options.hidden) {
    ctx.fillStyle = '#c3d2df';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(options.hidden, WIDTH / 2, HEIGHT / 2 + 5);
    return;
  }
  for (let i = 0; i < COLS * ROWS; i++) {
    const value = pixels[i];
    ctx.fillStyle = options.heatmap
      ? value > 0 ? `rgb(${140 + Math.min(115, value)}, ${90 + Math.min(70, value)}, 40)` : value < 0 ? '#4e9cca' : '#20394c'
      : `rgb(${value},${value},${value})`;
    ctx.fillRect(PAD + (i % COLS) * CELL, PAD + Math.floor(i / COLS) * CELL, CELL - 1, CELL - 1);
  }
  if (options.patch) {
    for (const patch of options.patch) {
      ctx.globalAlpha = patch.alpha;
      for (let y = BLOCK.y; y < BLOCK.y + BLOCK.height; y++) {
        for (let x = 0; x < BLOCK.width; x++) {
          const value = patch.pixels[y * COLS + patch.sourceX + x];
          ctx.fillStyle = `rgb(${value},${value},${value})`;
          ctx.fillRect(PAD + (patch.x + x) * CELL, PAD + y * CELL, CELL - 1, CELL - 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  if (options.neighbors) {
    ctx.fillStyle = '#162b3e'; ctx.fillRect(PAD, PAD, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = '#c3d2df'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('当前待预测区域', WIDTH / 2, HEIGHT / 2 + 5);
    ctx.strokeStyle = '#dfac58';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(5, HEIGHT - PAD); ctx.lineTo(5, 5); ctx.lineTo(WIDTH - PAD, 5); ctx.stroke();
  }
  if (Number.isFinite(options.selection)) {
    ctx.strokeStyle = '#f5b958'; ctx.lineWidth = 2;
    ctx.strokeRect(PAD + options.selection * CELL - 1, PAD + BLOCK.y * CELL - 1, BLOCK.width * CELL, BLOCK.height * CELL);
  }
  if (Number.isInteger(options.sampleIndex)) {
    ctx.strokeStyle = '#65d7d0'; ctx.lineWidth = 2;
    ctx.strokeRect(PAD + (options.sampleIndex % COLS) * CELL, PAD + Math.floor(options.sampleIndex / COLS) * CELL, CELL - 1, CELL - 1);
  }
}

function predictionSteps(mode, scene) {
  const changed = scene.changedPixels;
  return [
    { title: '编码器已经看到了当前画面', text: '右边是已经拍到、准备压缩的原画面。左边是允许使用的依据。接下来要找一种省数据的表达方法。', result: '解码器还没有重建结果' },
    { title: mode === 'I' ? '用同幅画面的邻居先估一个值' : '在参考画面里寻找相似区域', text: mode === 'I'
      ? '金色边线表示本幅画面中已重建的上方、左侧像素。本例这些值都是 40，所以先用 40 预测当前区域。I 帧也可以有预测，只是依据来自本幅画面。'
      : mode === 'P' ? '金色方框逐个比较候选位置与当前原画面，选择差异较小的一块。编码器会把选中的参考和位置告诉解码器。它不需要猜小球将来会去哪。'
      : '两幅参考各自寻找与当前区域相似的块。本例都已提前解码，不需要解码器等一幅“还没拍到”的图。', result: '正在确定预测依据' },
    { title: '按选定的依据，算出预测画面', text: mode === 'I'
      ? '当前区域暂时填成灰色 40。它预测好了平坦背景，却没有表达小球，剩下的差别要继续编码。'
      : mode === 'P' ? `把匹配块放到当前位置。本例向右移动 ${scene.targetX - scene.matches[0].x} 格。位置接近了，但原画面里的亮度变化还没有补上。`
      : '先把左右两幅参考中的匹配块分别对齐到当前位置，再逐像素取平均。本例小球的基础亮度是 (160 + 200) ÷ 2 = 180。', result: '预测画面 · 还没加差值' },
    { title: '把预测没表达好的部分记成差值', text: `编码器用当前原画面减去预测，得到残差。橙色表示这里还要加亮；蓝色表示需要减暗。本次示意有 ${changed} 个像素的差值不为 0。`, result: '残差图 · 只显示差值的位置' },
    { title: '解码器用预测加差值，重建画面', text: '解码器根据收到的预测方式、参考位置和残差来重建。这个小实验没有量化损失，所以能够逐像素还原原画面；真实有损编码会有精度损失。', result: '重建画面 · 与右上原画面对照' }
  ];
}

class VideoCodingDemo extends HTMLElement {
  connectedCallback() {
    if (this.events) return;
    this.lesson = this.getAttribute('lesson') || 'prediction';
    if (!['prediction', 'frame-order'].includes(this.lesson)) return;
    this.mode = Object.hasOwn(TYPES, this.getAttribute('mode')) ? this.getAttribute('mode') : 'P';
    this.changed = true;
    this.step = 0;
    this.phase = 1;
    this.speed = 1;
    this.playing = false;
    this.raf = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.events = new AbortController();
    const { signal } = this.events;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.render();
    this.shadowRoot.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.mode) {
        this.pause(); this.mode = button.dataset.mode; this.step = 0; this.phase = 1;
        this.render(); this.shadowRoot.querySelector(`[data-mode="${this.mode}"]`).focus();
      } else if (button.dataset.action === 'play') this.playing ? this.pause() : this.play();
      else if (button.dataset.action === 'expand') this.expand();
      else if (button.dataset.action === 'close') this.shadowRoot.querySelector('dialog').close();
      else if (button.dataset.action === 'next') this.seek(this.step + 1);
      else if (button.dataset.action === 'previous') this.seek(this.step - 1);
      else if (button.dataset.action === 'reset') this.seek(0);
    }, { signal });
    this.shadowRoot.addEventListener('input', event => {
      if (event.target.matches('[data-progress]')) this.seek(Number(event.target.value));
    }, { signal });
    this.shadowRoot.addEventListener('change', event => {
      if (event.target.matches('[data-change]')) {
        this.pause(); this.changed = event.target.checked; this.refreshScene(); this.update();
      }
      if (event.target.matches('[data-speed]')) this.speed = Number(event.target.value);
    }, { signal });
    this.shadowRoot.addEventListener('close', event => {
      if (event.target.tagName === 'DIALOG') this.collapse();
    }, { capture: true, signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing) this.pause('已暂停：页面暂时不可见。'); }, { signal });
    document.addEventListener('astro:before-swap', () => {
      this.pause(); this.shadowRoot.querySelector('dialog')?.close();
    }, { signal });
    this.observer = new IntersectionObserver(entries => {
      if (this.playing && entries.some(entry => !entry.isIntersecting)) this.pause('已暂停：演示已离开阅读区域。');
    });
    this.observer.observe(this);
    this.dataset.ready = 'true';
  }

  disconnectedCallback() {
    this.pause();
    this.shadowRoot.querySelector('dialog')?.close();
    this.observer?.disconnect();
    this.events?.abort();
    this.events = null;
    delete this.dataset.ready;
  }

  refreshScene() {
    this.scene = createPrediction(this.mode, this.changed);
    this.steps = this.lesson === 'prediction' ? predictionSteps(this.mode, this.scene) : ORDER_STEPS;
  }

  render() {
    this.refreshScene();
    const prediction = this.lesson === 'prediction';
    const wasExpanded = Boolean(this.shadowRoot.querySelector('dialog')?.open);
    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="inline-stage"><section class="demo" data-lesson="${this.lesson}" aria-label="${prediction ? 'I、P、B 帧预测交互演示' : 'B 帧解码与显示顺序演示'}">
        <header class="heading">
          <button type="button" class="expand" data-action="expand">放大演示 ↗</button>
          <div class="eyebrow">VIDEO LAB / ${prediction ? '01 · 预测与还原' : '02 · 两种顺序'}</div>
          <h3>${prediction ? '画面怎样被“借用”和还原' : '先解码后面的画面，再显示中间'}</h3>
          <p class="intro">${prediction ? '切换 I / P / B，点击播放；也可以用“下一步”慢慢看。' : '点击播放，看参考画面先准备好，再按时间交给观众。'}</p>
        </header>
        ${prediction ? this.predictionMarkup() : this.orderMarkup()}
        <div class="workbench">
          <div class="panel"><div class="label" data-result-label></div><canvas data-canvas="result" width="264" height="184" role="img" aria-label="重建过程示意"></canvas></div>
          <div><div class="stage-number" data-stage-number></div><strong class="stage-title" data-stage-title></strong><p class="explanation" data-explanation></p><p class="formula" data-formula></p></div>
        </div>
        <div class="controls">
          <label class="progress-label"><span>逐步观察</span><span data-progress-label></span></label>
          <input data-progress type="range" min="0" max="${this.steps.length - 1}" value="0" step="1" aria-label="演示步骤" />
          <div class="buttons">
            <button type="button" data-action="previous" aria-label="上一步">上一步</button>
            <button type="button" data-action="play" class="play">▶ 播放演示</button>
            <button type="button" data-action="next" aria-label="下一步">下一步</button>
            <button type="button" data-action="reset" aria-label="从头开始">重置</button>
            <label class="speed">速度 <select data-speed aria-label="演示速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
          </div>
          <p class="live-status" role="status" aria-live="polite" data-status></p>
        </div>
        <p class="note">${prediction ? '灰度像素教学模型，省略变换、量化和码流打包。I 只展示一种帧内预测；P/B 也可以有帧内块。B 的双参考等权平均仅为本例选择，并非所有 B 帧的固定做法。' : '三帧依赖关系示意，动画时长不是视频真实延迟。实际解码与显示可以交错进行；本例为看清顺序，先完成解码再播放。B1 的差值来自编码数据，不是播放器自动插帧。'}</p>
      </section></div>
      <dialog class="dialog" aria-label="放大的视频编码演示"><div class="dialog-header"><span>${prediction ? 'I / P / B · 预测与还原' : 'B 帧 · 解码与显示'}</span><button type="button" data-action="close" autofocus>关闭放大演示</button></div><div class="modal-stage"></div></dialog>`;
    this.shadowRoot.querySelector('[data-speed]').value = String(this.speed);
    this.update();
    if (wasExpanded) this.expand();
  }

  predictionMarkup() {
    const refs = this.mode === 'I' ? 1 : this.scene.references.length;
    return `<div class="mode-picker" role="group" aria-label="选择帧类型">${Object.entries(TYPES).map(([type, info]) => `<button type="button" data-mode="${type}" aria-pressed="${type === this.mode}"><b>${type}</b>${info.label}</button>`).join('')}</div>
      <p class="premise">${TYPES[this.mode].premise}</p>
      <div class="sources">
        <div class="panel"><div class="label">${TYPES[this.mode].reference}</div>
          <div class="references" data-count="${refs}">${Array.from({ length: refs }, (_, i) => `<div><canvas data-canvas="reference-${i}" width="264" height="184" role="img" aria-label="${this.mode === 'I' ? '本幅画面上方与左侧的邻近像素' : `已解码参考画面 ${i + 1}`}" ></canvas>${refs === 2 ? `<small>${i === 0 ? '较早显示 · I0' : '较晚显示 · P2'}</small>` : ''}</div>`).join('')}</div>
          <p class="mini-note" data-reference-note></p>
        </div>
        <div class="panel"><div class="label">当前原画面 <span>编码器已知</span></div><canvas data-canvas="current" width="264" height="184" role="img" aria-label="已经拍到、准备压缩的当前原画面"></canvas><p class="mini-note">青色框标出下方公式观察的像素。</p></div>
      </div>
      <label class="change"><input type="checkbox" data-change ${this.changed ? 'checked' : ''} />让当前小球变亮，再观察差值怎样变化</label>`;
  }

  orderMarkup() {
    return `<p class="premise">上排按显示时间排列。准备 B1 时，先看看它依赖的 I0、P2 是否已重建。</p>
      <div class="order-strip">${ORDER_FRAMES.map(frame => `<div class="frame-card" data-frame="${frame.id}"><div class="label">${frame.id}<span>${frame.time}</span></div><canvas data-canvas="${frame.id}" width="264" height="184" role="img" aria-label="${frame.id} 解码状态"></canvas><span class="status" data-frame-status="${frame.id}"></span></div>`).join('')}</div>
      <div class="decode-order"><span>解码准备：</span><b data-order="I0">I0</b><span>→</span><b data-order="P2">P2</b><span>→</span><b data-order="B1">B1</b></div>`;
  }

  text(selector, value) { this.shadowRoot.querySelector(selector).textContent = value; }
  canvas(id) { return this.shadowRoot.querySelector(`[data-canvas="${id}"]`); }

  expand() {
    const dialog = this.shadowRoot.querySelector('dialog');
    if (dialog.open) return;
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
    inline.appendChild(this.shadowRoot.querySelector('.demo'));
    inline.style.minHeight = '';
    this.dataset.expanded = 'false';
    if (this.isConnected) this.shadowRoot.querySelector('[data-action="expand"]').focus({ preventScroll: true });
  }

  update() {
    const step = this.steps[this.step];
    this.dataset.step = String(this.step);
    this.dataset.mode = this.mode;
    this.dataset.playing = String(this.playing);
    this.text('[data-stage-number]', `STEP ${String(this.step + 1).padStart(2, '0')} / ${this.steps.length}`);
    this.text('[data-stage-title]', step.title);
    this.text('[data-explanation]', step.text);
    this.text('[data-progress-label]', `${this.step + 1} / ${this.steps.length}`);
    const range = this.shadowRoot.querySelector('[data-progress]');
    range.value = String(this.step); range.setAttribute('aria-valuetext', step.title);
    this.shadowRoot.querySelector('[data-action="previous"]').disabled = this.step === 0;
    this.shadowRoot.querySelector('[data-action="next"]').disabled = this.step === this.steps.length - 1;
    this.text('[data-action="play"]', this.playing ? 'Ⅱ 暂停' : this.step === this.steps.length - 1 ? '↻ 再看一次' : '▶ 播放演示');
    this.text('[data-status]', step.title);
    this.text('[data-result-label]', this.lesson === 'prediction' ? step.result : '观众看到的画面');
    if (this.lesson === 'prediction') {
      const s = this.scene;
      const i = s.sampleIndex;
      this.text('[data-formula]', this.step === 3 ? `青框像素：原画面 ${s.current[i]} − 预测 ${s.prediction[i]} = 差值 ${s.residual[i]}`
        : this.step === 4 ? `青框像素：预测 ${s.prediction[i]} + 差值 ${s.residual[i]} = 重建 ${s.reconstructed[i]}`
        : this.mode === 'I' ? '本例邻近像素都是 40 → 预测先取 40。'
        : this.mode === 'B' ? '先对齐两个参考 → 取平均 → 再加差值。' : '找到参考块 → 记录取样位置 → 再加差值。');
      this.text('[data-reference-note]', this.mode === 'I' ? '金色边线：本幅画面已重建的邻居，亮度为 40。'
        : this.step === 1 ? '金框：比较候选取样区域。' : '金框：被选中的参考区域。');
    } else {
      this.dataset.decoded = step.decoded.join(',');
      this.dataset.output = step.output || '';
      this.text('[data-formula]', this.step < 3 ? 'B1 需要 I0 和 P2：先准备参考，才有依据重建。' : '解码：I0 → P2 → B1 ｜ 显示：I0 → B1 → P2');
      for (const frame of ORDER_FRAMES) {
        const ready = step.decoded.includes(frame.id);
        this.shadowRoot.querySelector(`[data-frame="${frame.id}"]`).dataset.active = String(step.active === frame.id || step.output === frame.id);
        this.shadowRoot.querySelector(`[data-order="${frame.id}"]`).dataset.ready = String(ready);
        this.text(`[data-frame-status="${frame.id}"]`, step.output === frame.id ? '正在显示' : ready ? '已解码 · 可作参考' : frame.id === 'B1' ? '等待两幅参考' : '尚未解码');
      }
    }
    this.draw();
  }

  draw() {
    if (this.lesson === 'frame-order') {
      const step = this.steps[this.step];
      for (const frame of ORDER_FRAMES) drawFrame(this.canvas(frame.id), frame.pixels, { hidden: step.decoded.includes(frame.id) ? '' : '等待解码' });
      const shown = ORDER_FRAMES.find(frame => frame.id === step.output);
      drawFrame(this.canvas('result'), shown?.pixels, { hidden: shown ? '' : '先准备解码画面' });
      return;
    }
    const s = this.scene;
    const phase = this.reducedMotion.matches ? 1 : this.phase;
    drawFrame(this.canvas('current'), s.current, { sampleIndex: s.sampleIndex, selection: s.targetX });
    if (this.mode === 'I') drawFrame(this.canvas('reference-0'), Array(COLS * ROWS).fill(BACKGROUND), { neighbors: true });
    s.references.forEach((reference, index) => {
      const match = s.matches[index];
      const candidate = this.step === 1 && phase < .85 ? Math.min(8, Math.floor(phase / .85 * 9)) : match.x;
      drawFrame(this.canvas(`reference-${index}`), reference, { selection: candidate });
    });
    if (this.step < 2) drawFrame(this.canvas('result'), null, { hidden: this.step === 0 ? '等待预测方式与差值' : '正在选择预测依据' });
    else if (this.step === 2 && this.mode !== 'I' && phase < .6) {
      drawFrame(this.canvas('result'), Array(COLS * ROWS).fill(BACKGROUND), { patch: s.references.map((pixels, i) => ({ pixels, sourceX: s.matches[i].x, x: s.matches[i].x + (s.targetX - s.matches[i].x) * phase / .6, alpha: s.references.length === 2 ? .65 : 1 })) });
    } else if (this.step === 3) drawFrame(this.canvas('result'), s.residual, { heatmap: true, sampleIndex: s.sampleIndex });
    else drawFrame(this.canvas('result'), this.step === 4 ? s.reconstructed : s.prediction, { sampleIndex: s.sampleIndex });
  }

  seek(step) {
    this.pause(); this.step = Math.max(0, Math.min(this.steps.length - 1, step)); this.phase = 1; this.update();
  }

  play() {
    if (this.playing) return;
    if (this.step === this.steps.length - 1) { this.step = 0; this.phase = 0; }
    else if (this.phase >= 1) this.phase = 0;
    this.playing = true; this.lastTime = performance.now(); this.update();
    const tick = now => {
      if (!this.playing || !this.isConnected) return;
      this.phase = Math.min(1, this.phase + (now - this.lastTime) / 2600 * this.speed);
      this.lastTime = now;
      if (this.phase >= 1) {
        this.step += 1; this.phase = 0;
        if (this.step >= this.steps.length - 1) { this.step = this.steps.length - 1; this.phase = 1; this.pause(); this.update(); return; }
        this.update();
      } else this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause(message) {
    this.playing = false;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.dataset.playing = 'false';
    const play = this.shadowRoot?.querySelector('[data-action="play"]');
    if (play) play.textContent = this.step === this.steps.length - 1 ? '↻ 再看一次' : '▶ 播放演示';
    if (message && this.shadowRoot) this.text('[data-status]', message);
  }
}

export function registerVideoCodingDemo() {
  if (!customElements.get('video-coding-demo')) customElements.define('video-coding-demo', VideoCodingDemo);
}
