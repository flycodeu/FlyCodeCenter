import { encrypt, fromBase64Url, toBase64Url } from './crypto-protocol.mjs';

const result = document.querySelector('#result');
const buttons = [...document.querySelectorAll('button')];

async function run(scenario) {
  buttons.forEach(button => { button.disabled = true; });
  result.textContent = '正在获取挑战并加密演示请求…';
  try {
    const response = await fetch('/auth/login/challenge', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`获取挑战失败（HTTP ${response.status}）。`);
    const csrf = response.headers.get('X-CSRF-Token');
    const envelope = await encrypt(await response.json());
    if (scenario === 'tamper') {
      const changed = fromBase64Url(envelope.ciphertext);
      changed[0] ^= 1;
      envelope.ciphertext = toBase64Url(changed);
    }
    const submit = async () => {
      const response = await fetch('/auth/login/secure', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(envelope) });
      const body = await response.json();
      return `HTTP ${response.status} · ${body.code}\n${body.message}`;
    };
    const first = await submit();
    result.textContent = scenario === 'replay' ? `第一次：${first}\n\n重放：${await submit()}` : first;
  } catch (error) {
    result.textContent = `请求未完成：${error.message}\n请检查 Java 服务已启动，并从同一服务的 HTTP 地址打开本页。`;
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

buttons.forEach(button => button.addEventListener('click', () => run(button.dataset.case)));
