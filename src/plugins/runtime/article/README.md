# Article Runtime Plugin

Entry: `src/plugins/runtime/article/index.js`

This plugin owns all post-page runtime enhancements that used to live in
`src/layouts/PostLayout.astro` inline script.

Main responsibilities:

- Anti-crawl lock
- Mermaid / Draw.io / ECharts runtime rendering
- Chart.js card rendering
- Code block toolbar and copy interactions
- KaTeX copy interaction
- Tabs interaction
- Inline icon runtime loading
- View stats sync
- Reading history persistence
- Interactive video coding lessons (loaded only when an article contains `video-coding-demo`)
- Local Web Crypto login experiment (loaded only when an article contains `login-crypto-demo`)
- Interactive parameter-learning walkthrough (loaded only when an article contains `param-learning-demo`)
- Interactive step-adjusting parameter search walkthrough (loaded only when an article contains `step-adjust-demo`)
- Interactive two-parameter grid search walkthrough (loaded only when an article contains `two-param-demo`)
- Interactive train/test split evaluation walkthrough (loaded only when an article contains `train-test-demo`)
- Interactive feature transformation walkthrough (loaded only when an article contains `feature-transform-demo`)

If you need to change article runtime behavior, start here.

## 在 Markdown 中嵌入编码动画

普通 `.md` 文章可以直接使用下面的 HTML，无需改成 MDX：

```html
<video-coding-demo lesson="prediction" mode="P">
  <p>未启用 JavaScript 时显示的文字说明。</p>
</video-coding-demo>

<video-coding-demo lesson="frame-order">
  <p>解码顺序 I0、P2、B1；显示顺序 I0、B1、P2。</p>
</video-coding-demo>
```

- `prediction` 展示 I/P/B 的预测与残差；`mode` 可选 `I`、`P`、`B`，默认 `P`。
- `frame-order` 展示三帧的参考依赖与解码、显示顺序。
- 每个实例都有独立的播放、暂停、逐步、重置、拖动进度和速度控制。可放大到对话框，按 Esc 或关闭按钮返回。默认静止；离开视口、隐藏页面或路由离开时暂停。
- 支持键盘操作和 `prefers-reduced-motion`，关闭连续搬动效果后仍可逐步阅读。Shadow DOM 隔离文章样式，并继承站点主题变量。
- 使用本地 Canvas 绘图和像素运算，不加载外部动画库或执行文章中的 JavaScript。新教学内容应在模块中实现、注册明确的 lesson，并提供静态文字说明。

实现分为 `video-coding-model.js`（教学计算）、`video-coding-demo.js`（交互与生命周期）、`video-coding-demo.css`（演示样式）。模型没有变换、量化或真实码流打包，不得当成标准编码器或压缩率测量。

## 在 Markdown 中嵌入登录加密实验

```html
<login-crypto-demo>
  <p>本实验用固定演示账号展示 P-256 密钥协商、AES-GCM 加解密，以及重复和过期提交的拒绝。启用 JavaScript 后可点击操作。</p>
</login-crypto-demo>
```

组件全程在浏览器本地运行，不发送网络请求或读取真实凭据。Web Crypto 执行 P-256 ECDH、HKDF-SHA256 和 AES-GCM-256；挑战的消费、120 秒期限由本地内存模型展示，不表示页面运行了真实后端。过期按钮把模型的校验时间快进 121 秒。每个按钮单独创建新挑战，无需按固定顺序操作。

“正常提交”会额外显示三步结果：两端公开交换的 SPKI 公钥长度、各自独立派生的 AES 密钥是否一致、AES-GCM 还原的数据。模型只返回密钥比较的布尔值，临时比较缓冲使用后清零，界面不显示私钥或密钥材料。`encryptLoginWithProof` 返回 `{ envelope, proof }`；原 `encryptLogin` 仍只返回四字段密文信封。

“运行 RSA-OAEP 示例”使用真实 Web Crypto RSA-2048、65537 公钥指数和 OAEP-SHA256，加密固定虚构短文本 `demo-session-key` 两次，再用私钥分别解密。结果显示输入、256 字节密文长度、还原一致和 OAEP 随机性；密文可展开查看。短文本代表密钥运输的输入，不是实际密钥；该示例不改变上方 ECDH 登录流程，业务数据仍交给 AES 处理。`runRsaOaepExample` 只返回演示输入、密文和核对结果，不返回密钥。

“比较密码哈希”执行 PBKDF2-SHA256（600000 次、16 字节随机盐、256 位结果），对比两份盐及正确/错误密码。它用于说明密码存储的计算过程，不生成应用数据库的完整哈希编码格式。环境不支持 Web Crypto 时显示说明并禁用按钮；需通过 HTTPS 或 localhost 访问。

`login-crypto-model.js`负责计算和本地挑战模型，`login-crypto-demo.js`负责交互与路由离开后的异步结果丢弃，`login-crypto-demo.css`继承现有主题并隔离文章样式。无正文脚本执行、新依赖或存储写入。

定向检查：`node --test tests/unit/login-crypto-model.test.mjs`。生产页面验收依次点击“正常提交”“篡改密文”“重复提交”“过期挑战”，应分别显示成功、GCM 校验失败、已消费、已过期；点击“比较密码哈希”应显示不同随机盐/哈希、正确密码匹配且错误密码不匹配。检查 390px 窄屏、键盘聚焦和按钮禁用、离开后返回页面重新操作；不要为了自动化验收关闭站点防爬。

新增验收：正常提交后 `data-same-aes-key="true"`，三步结果可见；“运行 RSA-OAEP 示例”完成后 `data-rsa-result="verified"`，输入为固定演示文本，密文256字节，解密一致且两次密文不同。原五按钮及 `data-result`、`data-hash-result` 契约保持不变。

## 在 Markdown 中嵌入参数学习动画

```html
<param-learning-demo mode="double">
  <p>交互演示需要 JavaScript。例题依次尝试候选参数 [1, 2, 3, 4]，比较总误差后选出 weight = 2，并预测输入 4 的结果为 8。</p>
</param-learning-demo>
```

- `mode` 可选 `double`（例题 `[(1, 2), (2, 4), (3, 6)]`）或 `triple`（练习 `[(1, 3), (2, 6), (3, 9)]`），默认 `double`，页面内也可切换。
- 由 `param-learning-model.js`（步骤计算）、`param-learning-demo.js`（交互、Canvas 绘图与生命周期）、`learning-demo-canvas.js` 与 `learning-demo-shared.css`（共享坐标系渲染与 Shadow DOM 样式）组成，不依赖外部动画库。

```html
<step-adjust-demo mode="fine">
  <p>交互演示需要 JavaScript。默认以 step = 0.1 从 1.0 出发沿误差曲线走到 2.5；切换至 step = 1.0 时会在 2.0 处跨过 2.5 而提前停止。</p>
</step-adjust-demo>
```

- `mode` 可选 `fine`（`step = 0.1`）、`coarse`（`step = 1.0`）或 `reverse`（`weight = 3.5, step = 0.1`），由 `step-adjust-model.js` 与 `step-adjust-demo.js` 驱动。

```html
<two-param-demo mode="affine32">
  <p>交互演示需要 JavaScript。默认样例 [(1, 5), (2, 8), (3, 11)] 扫描 25 组 (weight, bias)，选出 (3, 2) 并预测输入 4 得 14。</p>
</two-param-demo>
```

- `mode` 可选 `affine32`（`3x + 2`）或 `affine24`（`2x + 4`），由 `two-param-model.js` 与 `two-param-demo.js` 驱动，支持点击 5×5 误差矩阵格子直接跳转。

```html
<train-test-demo mode="doubling">
  <p>交互演示需要 JavaScript。默认用 [(1, 2), (2, 4)] 训练并选中 (2, 0)，再用未参与训练的 [(3, 8), (4, 16)] 测试，揭示训练平均误差 0.0 与测试平均误差 5.0 的差异。</p>
</train-test-demo>
```

- `mode` 可选 `doubling`（翻倍样例，训练 `0.0` / 测试 `5.0`）或 `linear_ex`（同直线练习，训练 `0.0` / 测试 `0.0`），由 `train-test-model.js` 与 `train-test-demo.js` 驱动。

```html
<feature-transform-demo mode="exp_basic">
  <p>交互演示需要 JavaScript。先算 transformed_x = 2 ** x 将指数曲线拉直，再用相同训练循环找到参数，验证 x = 5、6 测试误差均为 0.0。</p>
</feature-transform-demo>
```

- `mode` 可选 `exp_basic`（`y = 2^x`）或 `exp_exercise`（`y = 3×(2^x) + 1`），由 `feature-transform-model.js` 与 `feature-transform-demo.js` 驱动。
