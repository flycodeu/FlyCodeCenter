import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import matter from 'gray-matter';

const root = new URL('../../', import.meta.url);
const article = matter(await readFile(new URL('src/content/blog/USB单路继电器零基础入门与Python实操.md', root), 'utf8'));
const examples = new URL('public/examples/usb-relay/', root);
const normalize = value => value.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimEnd();

test('USB relay article keeps its route and exact short downloadable example', async () => {
  assert.equal(article.data.code, 'b2kz8iy4i');
  assert.equal(article.data.permalink, '/blog/b2kz8iy4i/');
  const blocks = [...article.content.matchAll(/^```python\r?\n([\s\S]*?)^```/gm)];
  assert.equal(blocks.length, 1, 'one complete Python example, no competing fragments');
  assert.equal(normalize(blocks[0][1]), normalize(await readFile(new URL('relay_demo.py', examples), 'utf8')));
  assert.ok(normalize(blocks[0][1]).split('\n').length <= 17);
  assert.doesNotMatch(blocks[0][1], /argparse|EXPECTED_USB_ID|def check_target|while |time\.sleep|finally:/);
  assert.match(blocks[0][1], /written != 4/);
  assert.equal((blocks[0][1].match(/relay\.write\(/g) || []).length, 1);
});

test('USB relay beginner download declares UTF-8 and explains interpreter mismatch', async () => {
  const source = await readFile(new URL('relay_demo.py', examples));
  assert.deepEqual([...source.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
  const text = source.toString('utf8');
  assert.doesNotMatch(text, /\uFFFD|鎸囦护|绋嬪簭/);
  assert.match(text, /已发送开（吸合）指令。/);
  assert.match(text, /已发送关（释放）指令。/);
  assert.match(text, /except ModuleNotFoundError:/);
  assert.match(text, /sys\.executable/);
  assert.match(text, /输入 yes 后回车/);
  assert.match(text, /!= "yes"/);
  assert.doesNotMatch(article.content, /YES/);
  assert.match(article.content, /输入小写的 `yes`/);
  assert.match(article.content, /UTF-8 BOM/);
  assert.match(article.content, /\.\\\.venv\\Scripts\\python\.exe/);
  assert.match(article.content, /进入文件夹不会自动启用/);
});

test('USB relay downloads keep the short example and compatible optional tools', async () => {
  const names = ['README.md', 'relay_demo.py', 'test_relay_demo.py', 'relay_control.py', 'requirements.txt', 'test_relay_control.py'];
  assert.deepEqual((await readdir(fileURLToPath(examples))).sort(), names.sort());
  const linked = new Set([...article.content.matchAll(/\]\(\/examples\/usb-relay\/([^/)]+)\)/g)].map(match => match[1]));
  assert.deepEqual([...linked].sort(), names.sort());
  for (const name of names) assert.ok((await readFile(new URL(name, examples), 'utf8')).length > 0);
  assert.equal((await readFile(new URL('requirements.txt', examples), 'utf8')).trim(), 'pyserial==3.5');
});

test('USB relay article records live sending and user feedback without inventing contact measurements', () => {
  assert.match(article.content, /使用者已确认听到了本次测试的切换声/);
  assert.match(article.content, /13:50:09/);
  assert.match(article.content, /13:50:23/);
  assert.match(article.content, /触点通断未做万用表测量/);
  assert.match(article.content, /没有万用表实测证据/);
  assert.match(article.content, /不是作者通过程序听到了声音/);
  assert.match(article.content, /不要接了灯还输入 yes/);
  assert.match(article.content, /模块附带文件仅用于核对协议，不是本文的授课主线/);
  assert.match(article.content, /不是整块 USB 控制板的型号/);
  assert.match(article.content, /这仍不是完整的现场常驻控制服务/);
});

test('beginner path introduces every required action before the first live command', () => {
  const steps = ['## 一、', '## 二、', '## 三、', '## 四、', '## 五、', '## 六、'];
  const positions = steps.map(step => article.content.indexOf(step));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, positions.toSorted((a, b) => a - b));
  assert.match(article.content, /python -m pip install pyserial==3\.5/);
  assert.match(article.content, /python -m serial\.tools\.list_ports/);
  assert.match(article.content, /relay_demo\.py\.txt/);
  assert.match(article.content, /逐条输入/);
  assert.match(article.content, /python \.\\relay_demo\.py on/);
  assert.match(article.content, /python \.\\relay_demo\.py off/);
  assert.match(article.content, /`on` 不会顺便执行 `off`/);
  assert.doesNotMatch(article.content, /time\.sleep\(|finally:|## 五、第一个程序：吸合两秒/);
  assert.doesNotMatch(article.content, /Usb_Test\.py|def check_target|--confirm-no-load/);
  const appendix = article.content.indexOf('<details>');
  assert.ok(appendix > article.content.indexOf('## 十、'));
  assert.ok(article.content.indexOf('/examples/usb-relay/relay_control.py') > appendix);
});

test('USB relay troubleshooting stays focused on device and serial connection issues', () => {
  const section = article.content.match(/^## 七、[^\r\n]*\r?\n([\s\S]*?)(?=^## 八、)/m)?.[1];
  assert.ok(section);
  assert.match(section, /PWR 亮，设备管理器没有对应串口/);
  assert.match(section, /提示找不到 COM 口/);
  assert.match(section, /打开串口时提示拒绝访问/);
  assert.match(section, /程序无报错，但没有预期动作/);
  assert.doesNotMatch(section, /中文提示|UTF-8|No module|pySerial|pip install|python.*无法运行|relay_demo\.py|显示“用法/);
  assert.equal(section.split(/\r?\n/).filter(line => line.startsWith('|')).length, 6);
});
