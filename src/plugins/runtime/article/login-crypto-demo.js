import styles from './login-crypto-demo.css?inline';
import {
  CHALLENGE_LIFETIME, DEMO_LOGIN, DemoRejection, comparePasswordHashes,
  createChallenge, encryptLoginWithProof, runRsaOaepExample, submitLogin, tamperCiphertext
} from './login-crypto-model.js';

const scenarios = {
  normal: { title: '正常提交', expected: null, result: '已解密：四个字段与演示输入一致。', detail: '客户端与本地服务端分别派生密钥，AES-GCM 验证通过后才返回明文。这里没有连接真实账号系统。' },
  tamper: { title: '篡改密文', expected: 'CIPHERTEXT_INVALID', result: '已拒绝：密文被改动，GCM 校验失败。', detail: '只翻转密文中的一个比特，解密便失败。没有返回被篡改后的账号或密码。该挑战也已消费。' },
  replay: { title: '重复提交', expected: 'CHALLENGE_USED', result: '已拒绝：第一次成功，第二次提交被拦截。', detail: '第二次使用完全相同的密文。本地服务端模型记录挑战已消费；AES-GCM 本身不负责阻止重放。' },
  expired: { title: '过期挑战', expected: 'CHALLENGE_EXPIRED', result: '已拒绝：挑战已超过 120 秒。', detail: '本地服务端模型把校验时间快进 121 秒，无需真实等待。期限判断发生在解密之前。' }
};

class LoginCryptoDemo extends HTMLElement {
  connectedCallback() {
    this.generation = (this.generation || 0) + 1;
    this.controller?.abort();
    this.controller = new AbortController();
    this.busy = false;
    delete this.dataset.result;
    delete this.dataset.scenario;
    delete this.dataset.hashResult;
    delete this.dataset.rsaResult;
    delete this.dataset.sameAesKey;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${styles}</style>
      <section class="demo" aria-label="登录加密交互实验">
        <header class="heading">
          <span class="eyebrow">交互实验 / WEB CRYPTO</span>
          <h3>亲手走一遍密文登录</h3>
          <p>固定演示数据，全程在本浏览器运行，不发送登录请求。</p>
        </header>
        <div class="flow" aria-label="三个计算环节">
          <span><b>01</b> 交换公钥</span><span><b>02</b> 算出同一密钥</span><span><b>03</b> 加密与还原</span>
        </div>
        <div class="controls" role="group" aria-label="选择登录实验">
          <button type="button" data-action="normal" class="primary">正常提交</button>
          <button type="button" data-action="tamper">篡改密文</button>
          <button type="button" data-action="replay">重复提交</button>
          <button type="button" data-action="expired">过期挑战</button>
        </div>
        <div class="feedback" data-outcome="idle">
          <p class="status" data-status role="status" aria-live="polite" aria-atomic="true">点击“正常提交”，观察加密前、传输时和解密后的区别。</p>
          <p class="explanation" data-explanation>每个按钮都会新建挑战与临时密钥。重复提交、过期判断使用本地服务端模型；加密和解密由真实 Web Crypto 执行。</p>
        </div>
        <ol class="exchange-steps" data-exchange hidden aria-label="ECDH 实际计算结果">
          <li><strong>双方只交换公钥</strong><span data-public-keys></span></li>
          <li><strong>双方各自算出 AES 密钥</strong><span data-key-match></span></li>
          <li><strong>AES 加密并还原登录数据</strong><span>下方右侧是实际解密的固定示例。ECDH 负责协商，HKDF 负责派生，AES-GCM 负责加密与校验。</span></li>
        </ol>
        <details class="input"><summary>查看固定演示输入</summary><pre data-input></pre></details>
        <div class="outputs">
          <section class="panel"><h4>传输的密文信封</h4><p class="caption">公开参数 + 密文，没有明文密码字段</p><pre data-envelope>运行后显示 challengeId、公钥、IV 和密文。</pre></section>
          <section class="panel"><h4>本地服务端结果</h4><p class="caption" data-server-caption>先校验挑战，再验证 GCM</p><pre data-result>尚未提交。</pre></section>
        </div>
        <section class="rsa-section" aria-label="RSA 密钥运输实验">
          <div class="hash-heading"><div><h4>换成 RSA，怎么传一段短数据？</h4><p>RSA-2048 / OAEP-SHA256：用公钥加密，用私钥解密。</p></div>
          <button type="button" data-action="rsa">运行 RSA-OAEP 示例</button></div>
          <p class="rsa-status" data-rsa-status role="status" aria-live="polite" aria-atomic="true">用固定短文本代表要运送的 AES 密钥材料。业务数据仍由 AES 加密；这里演示的是密钥运输。</p>
          <dl class="proof-results" data-rsa-summary hidden>
            <div><dt>输入（虚构文本）</dt><dd data-rsa-input></dd></div>
            <div><dt>RSA 密文长度</dt><dd data-rsa-length></dd></div>
            <div><dt>解密与输入一致</dt><dd data-rsa-match></dd></div>
            <div><dt>同一输入加密两次</dt><dd data-rsa-random></dd></div>
          </dl>
          <details data-rsa-details hidden><summary>查看本次 RSA 密文（Base64URL）</summary><pre data-rsa></pre></details>
        </section>
        <section class="hash-section" aria-label="密码哈希实验">
          <div class="hash-heading"><div><h4>数据库为什么存哈希</h4><p>PBKDF2-SHA256 · 600000 次 · 16 字节随机盐 · 256 位结果</p></div>
          <button type="button" data-action="hash">比较密码哈希</button></div>
          <p class="hash-status" data-hash-status role="status" aria-live="polite" aria-atomic="true">同一演示密码，换一个盐就会得到不同结果。计算可能需要几秒。</p>
          <pre data-hash hidden></pre>
        </section>
      </section>`;
    this.text('[data-input]', JSON.stringify(DEMO_LOGIN, null, 2));
    const available = !!globalThis.crypto?.subtle;
    this.dataset.ready = available ? 'true' : 'unavailable';
    if (!available) {
      this.text('[data-status]', '当前环境无法使用 Web Crypto，请通过 HTTPS 或 localhost 打开。');
      this.shadowRoot.querySelectorAll('button').forEach(button => { button.disabled = true; });
      return;
    }
    this.shadowRoot.addEventListener('click', event => {
      const button = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
      if (!button || this.busy) return;
      void this.run(button.dataset.action);
    }, { signal: this.controller.signal });
  }

  disconnectedCallback() {
    this.generation += 1;
    this.controller?.abort();
  }

  text(selector, value) {
    this.shadowRoot.querySelector(selector).textContent = value;
  }

  setBusy(value) {
    this.busy = value;
    this.shadowRoot.querySelector('.demo').setAttribute('aria-busy', String(value));
    this.shadowRoot.querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  async run(action) {
    if (!scenarios[action] && action !== 'hash' && action !== 'rsa') return;
    const generation = this.generation;
    const active = () => this.isConnected && generation === this.generation;
    this.setBusy(true);
    try {
      if (action === 'rsa') {
        this.dataset.rsaResult = 'running';
        this.shadowRoot.querySelector('[data-rsa-summary]').hidden = true;
        this.shadowRoot.querySelector('[data-rsa-details]').hidden = true;
        this.text('[data-rsa-status]', '正在生成 RSA 密钥，用公钥加密两次，再分别用私钥解密…');
        const rsa = await runRsaOaepExample();
        if (!active()) return;
        this.text('[data-rsa-input]', `${rsa.input}（${rsa.inputBytes} 字节）`);
        this.text('[data-rsa-length]', `${rsa.ciphertextBytes} 字节（RSA-2048）`);
        this.text('[data-rsa-match]', `${rsa.decryptionMatches} · 还原为 ${rsa.decrypted}`);
        this.text('[data-rsa-random]', `${rsa.randomizedCiphertexts ? '密文不同' : '密文相同'} · OAEP 使用随机填充`);
        this.text('[data-rsa]', rsa.ciphertext);
        this.shadowRoot.querySelector('[data-rsa-summary]').hidden = false;
        this.shadowRoot.querySelector('[data-rsa-details]').hidden = false;
        this.text('[data-rsa-status]', '公钥加密、私钥解密已完成。两份不同的密文都能还原成同一段演示文本。');
        this.dataset.rsaResult = rsa.decryptionMatches && rsa.randomizedCiphertexts ? 'verified' : 'unexpected';
        return;
      }
      if (action === 'hash') {
        this.dataset.hashResult = 'running';
        this.shadowRoot.querySelector('[data-hash]').hidden = true;
        this.text('[data-hash-status]', '正在计算两份随机盐哈希，并比对正确、错误密码…');
        const hashes = await comparePasswordHashes();
        if (!active()) return;
        this.text('[data-hash-status]', `随机盐不同，哈希${hashes.first.hash !== hashes.second.hash ? '不同' : '相同'}；正确密码${hashes.correctMatches ? '匹配' : '不匹配'}，错误密码${hashes.wrongMatches ? '匹配' : '不匹配'}。`);
        const output = this.shadowRoot.querySelector('[data-hash]');
        output.hidden = false;
        output.textContent = JSON.stringify({ '第一次': hashes.first, '第二次': hashes.second }, null, 2);
        this.dataset.hashResult = hashes.correctMatches && !hashes.wrongMatches ? 'verified' : 'unexpected';
        return;
      }
      const scenario = scenarios[action];
      this.dataset.result = 'RUNNING';
      delete this.dataset.sameAesKey;
      this.shadowRoot.querySelector('[data-exchange]').hidden = true;
      this.text('[data-status]', `正在运行：${scenario.title}…`);
      this.text('[data-explanation]', '生成临时密钥并加密固定数据。计算结果会显示在下方。');
      this.text('[data-envelope]', '正在生成密文…');
      this.text('[data-result]', '等待校验。');
      const feedback = this.shadowRoot.querySelector('.feedback');
      feedback.dataset.outcome = 'running';
      const challenge = await createChallenge();
      const encrypted = await encryptLoginWithProof(challenge);
      let envelope = encrypted.envelope;
      if (action === 'tamper') envelope = tamperCiphertext(envelope);
      let rejection = null;
      let result = null;
      try {
        if (action === 'replay') await submitLogin(challenge, envelope);
        const now = action === 'expired' ? challenge.expiresAt + 1000 : Date.now();
        result = await submitLogin(challenge, envelope, now);
      } catch (error) {
        if (!(error instanceof DemoRejection)) throw error;
        rejection = error.code;
      }
      if (!active()) return;
      if (rejection !== scenario.expected) throw new Error('Unexpected demo result');
      this.text('[data-envelope]', JSON.stringify(envelope, null, 2));
      this.text('[data-result]', result ? JSON.stringify(result, null, 2) : `拒绝处理\n${rejection}\n\n未返回解密内容。`);
      this.text('[data-server-caption]', `本地模型 · 挑战已消费 · 有效期 ${CHALLENGE_LIFETIME / 1000} 秒`);
      this.text('[data-status]', scenario.result);
      this.text('[data-explanation]', scenario.detail);
      if (action === 'normal') {
        this.text('[data-public-keys]', `客户端公钥 ${encrypted.proof.clientPublicKeyBytes} 字节，服务端公钥 ${encrypted.proof.serverPublicKeyBytes} 字节。私钥留在各自一侧。`);
        this.text('[data-key-match]', `独立派生的 256 位 AES 密钥一致：${encrypted.proof.sameAesKey}。页面只显示比较结果，不显示密钥。`);
        this.shadowRoot.querySelector('[data-exchange]').hidden = false;
        this.dataset.sameAesKey = String(encrypted.proof.sameAesKey);
      }
      feedback.dataset.outcome = rejection ? 'rejected' : 'success';
      this.dataset.scenario = action;
      this.dataset.result = rejection || 'SUCCESS';
    } catch {
      if (!active()) return;
      const selector = action === 'hash' ? '[data-hash-status]' : action === 'rsa' ? '[data-rsa-status]' : '[data-status]';
      this.text(selector, '本次计算未完成，请重试或换用支持 Web Crypto 的浏览器。');
      if (action === 'hash') this.dataset.hashResult = 'error';
      else if (action === 'rsa') this.dataset.rsaResult = 'error';
      else {
        this.dataset.result = 'ERROR';
        this.shadowRoot.querySelector('.feedback').dataset.outcome = 'error';
      }
    } finally {
      if (active()) this.setBusy(false);
    }
  }
}

export function registerLoginCryptoDemo() {
  if (!customElements.get('login-crypto-demo')) customElements.define('login-crypto-demo', LoginCryptoDemo);
}
