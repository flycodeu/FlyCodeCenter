import styles from './learning-demo-shared.css?inline';

export class LearningDemoElement extends HTMLElement {
  connectedCallback() {
    if (this.events) return;
    const datasets = this.getDatasets();
    const initialMode = this.getAttribute('mode');
    this.mode = Object.hasOwn(datasets, initialMode) ? initialMode : this.getDefaultMode();
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

        if (typeof this.handleCanvasClick === 'function' && target.matches('[data-canvas="plot"]')) {
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
      'keydown',
      (event) => {
        if (event.target instanceof Element && event.target.matches('input, select')) return;
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.seek(this.step + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.seek(this.step - 1);
        } else if (event.key === ' ') {
          event.preventDefault();
          this.playing ? this.pause() : this.play();
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

  text(selector, value) {
    const node = this.shadowRoot.querySelector(selector);
    if (node) node.textContent = value;
  }

  renderShell({ ariaLabel, dialogTitle, eyebrow, title, intro, width, height, canvasLabel, legendHtml, varBoxesHtml, samplesHead, noteHtml, codeLines }) {
    this.refreshScene();
    const wasExpanded = Boolean(this.shadowRoot.querySelector('dialog')?.open);
    const modeButtons = Object.values(this.getDatasets())
      .map(
        (ds) =>
          `<button type="button" data-mode="${ds.key}" aria-pressed="${ds.key === this.mode}"><b>${ds.label}</b><code>${ds.samplesLabel}</code></button>`
      )
      .join('');
    const codeLinesHtml = codeLines
      .map((line, idx) => `<span class="code-line" data-line="${idx}">${line}</span>`)
      .join('');

    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <div class="inline-stage">
        <section class="demo" aria-label="${ariaLabel}">
          <header class="heading">
            <button type="button" class="expand" data-action="expand">放大演示 ↗</button>
            <div class="eyebrow">${eyebrow}</div>
            <h3>${title}</h3>
            <p class="intro">${intro}</p>
          </header>
          <div class="mode-picker" role="group" aria-label="切换样例数据集">${modeButtons}</div>
          <div class="stage-grid">
            <div class="canvas-panel">
              <canvas data-canvas="plot" width="${width}" height="${height}" role="img" aria-label="${canvasLabel}"></canvas>
              <div class="canvas-legend" aria-hidden="true">${legendHtml}</div>
            </div>
            <div class="workbench">
              <div>
                <div class="stage-number" data-stage-number></div>
                <strong class="stage-title" data-stage-title></strong>
                <p class="explanation" data-explanation></p>
              </div>
              <div class="formula" data-formula></div>
              <div class="vars-grid">${varBoxesHtml}</div>
              <div class="samples-box">
                <div class="samples-head" data-samples-head>${samplesHead}</div>
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
          <p class="note">${noteHtml}</p>
        </section>
      </div>
      <dialog class="dialog" aria-label="${dialogTitle}">
        <div class="dialog-header">
          <span>${dialogTitle}</span>
          <button type="button" data-action="close" autofocus>关闭放大演示</button>
        </div>
        <div class="modal-stage"></div>
      </dialog>`;

    this.shadowRoot.querySelector('[data-speed]').value = String(this.speed);
    this.update();
    if (wasExpanded) this.expand();
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

  updateCommon(step) {
    this.dataset.step = String(this.step);
    this.dataset.mode = this.mode;
    this.dataset.playing = String(this.playing);
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

    this.shadowRoot.querySelectorAll('.code-line').forEach((node) => {
      const idx = Number(node.dataset.line);
      node.dataset.active = String(step.activeLines.includes(idx));
    });
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
      const baseMs = typeof this.getStepDelay === 'function' ? this.getStepDelay(cur) : 780;
      const delay = this.reducedMotion.matches ? Math.min(500, baseMs) / this.speed : baseMs / this.speed;
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
