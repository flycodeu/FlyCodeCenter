'use strict';
const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="workbench-token"]').content;
const paths = {
  search: '/artemis/api/resource/v2/camera/search',
  subscribe: '/artemis/api/eventService/v1/eventSubscriptionByEventTypes',
  subscriptions: '/artemis/api/eventService/v1/eventSubscriptionView',
  unsubscribe: '/artemis/api/eventService/v1/eventUnSubscriptionByEventTypes',
  picture: '/artemis/api/video/v1/events/picture'
};
let ready = false, selected = null, cameras = [], page = 1, total = 0, lastQuery = null;
let info = null, messages = [], signature = '', polling = false, subscriptionSnapshot = null, cancelDraft = null;
let savedSettings = null;
const cards = new Map();
const eventName = type => ({192517: '温度报警', 192518: '温差报警'}[type] || '其他事件');
function notice(value, error = false) {
  $('message').textContent = value;
  $('message').className = 'notice' + (error ? ' error' : '');
}
function text(parent, tag, value, cls) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (cls) el.className = cls;
  parent.append(el);
  return el;
}
function credentials() {
  if (!ready) throw Error('接收服务未连接，请确认启动方式和管理会话。');
  const appKey = $('appKey').value.trim(), appSecret = $('appSecret').value;
  if (!appKey || (!appSecret && !savedSettings?.hik.secretSaved)) throw Error('请填写 AppKey 和 AppSecret。');
  return {platform: $('platform').value.trim(), appKey, appSecret, useSavedSecret: !appSecret, insecure: $('insecure').checked};
}
async function local(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: body === undefined ? {} : {'Content-Type': 'application/json', 'X-Workbench-Token': token},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw Error(data.error || '服务请求失败');
  return data;
}
async function call(action, body = {}, extra = {}, record = true) {
  const config = credentials();
  if (record) $('response').textContent = JSON.stringify({path: paths[action], request: body, response: '等待响应…'}, null, 2);
  try {
    const result = await local('/api/' + action, {...config, body, ...extra});
    if (record) $('response').textContent = JSON.stringify({path: paths[action], request: body, response: result}, null, 2);
    if (String(result.code) !== '0') throw Error('海康返回 ' + result.code + '：' + (result.msg || '调用失败'));
    return result;
  } catch (error) {
    if (record && $('response').textContent.includes('等待响应…')) {
      $('response').textContent = JSON.stringify({path: paths[action], request: body, error: error.message}, null, 2);
    }
    throw error;
  }
}
async function busy(button, task) {
  const old = button.textContent;
  button.disabled = true;
  button.textContent = '处理中…';
  try { await task(); } catch (error) { notice(error.message, true); }
  finally {
    button.textContent = old;
    button.disabled = false;
    if (button.id === 'testFeishu') updateTestButton();
    if (button.id === 'disablePush') button.disabled = !savedSettings?.feishu.enabled;
    if (button.id === 'subscribe') button.disabled = !ready || !selected;
    updateCancel();
  }
}
function resetSelection() {
  selected = null;
  $('selectedCamera').textContent = '尚未选择相机，请选择热成像通道；使用平台编码筛选。';
  $('subscribe').disabled = true;
  $('subscriptionState').textContent = '等待选择相机';
  renderEvents();
}
function renderCameras() {
  const host = $('cameraRows'); host.replaceChildren();
  $('cameras').classList.toggle('hidden', !cameras.length);
  $('cameraEmpty').classList.toggle('hidden', !!cameras.length);
  $('cameraEmpty').textContent = '没有匹配结果，请检查名称、区域与合作方资源权限。';
  for (const c of cameras) {
    const row = document.createElement('tr'), cell = document.createElement('td'), radio = document.createElement('input');
    host.append(row); cell.append(radio); row.append(cell);
    radio.type = 'radio'; radio.name = 'camera'; radio.setAttribute('aria-label', '选择 ' + c.name);
    radio.checked = selected?.indexCode === c.indexCode;
    if (radio.checked) row.className = 'selected';
    text(row, 'td', c.name || '未命名'); text(row, 'td', c.indexCode, 'code');
    text(row, 'td', c.externalIndexCode || '—', 'code'); text(row, 'td', c.chanNum ?? '—');
    radio.onchange = () => {
      selected = c;
      $('cameraLocation').value = savedSettings?.camera.indexCode === c.indexCode ? savedSettings.camera.location : '';
      $('saveState').textContent = '相机已变更，请保存配置';
      $('selectedCamera').textContent = '已选择：' + c.name + ' · ' + c.indexCode;
      $('subscribe').disabled = !ready;
      $('subscriptionState').textContent = '可订阅；所选相机只用于接收结果筛选';
      renderCameras(); renderEvents();
    };
  }
  const pages = Math.max(1, Math.ceil(total / 20));
  $('pageInfo').textContent = `第 ${page} / ${pages} 页 · 共 ${total} 个监控点`;
  $('prev').disabled = page <= 1; $('next').disabled = page >= pages;
}
async function search(target = 1, newQuery = false) {
  if (newQuery) {
    const name = $('cameraName').value.trim();
    if (!name) throw Error('请输入相机名称，避免全量查询。');
    if (new TextEncoder().encode(name).length > 32) throw Error('名称最多 32 个 UTF-8 字节，请使用较短关键词。');
    lastQuery = {name};
    const region = $('region').value.trim();
    if (region) Object.assign(lastQuery, {regionIndexCodes: [region], isSubRegion: true});
    resetSelection();
  }
  if (!lastQuery) return;
  const result = await call('search', {...lastQuery, pageNo: target, pageSize: 20});
  cameras = (result.data?.list || []).map(c => ({...c, indexCode: c.indexCode || c.cameraIndexCode})).filter(c => c.indexCode);
  page = target; total = Number(result.data?.total ?? cameras.length);
  renderCameras(); notice(`查询成功：共 ${total} 个监控点，请选择热成像相机。`);
}
function subscriptionTable(parent, rows) {
  const wrap = document.createElement('div'); wrap.className = 'table-wrap'; parent.append(wrap);
  const table = document.createElement('table'); wrap.append(table);
  const head = document.createElement('tr'); table.append(head);
  for (const label of ['接收地址', '事件类型', '与当前地址匹配']) text(head, 'th', label);
  for (const item of rows) {
    const row = document.createElement('tr'); table.append(row);
    text(row, 'td', item.eventDest);
    text(row, 'td', (item.eventTypes || []).map(t => `${t}${[192517,192518].includes(Number(t)) ? ' ' + eventName(t) : ''}`).join('、'));
    text(row, 'td', item.eventDest === $('callback').value.trim() ? '是' : '否');
  }
}
async function querySubscriptions(record = true) {
  const result = await call('subscriptions', {}, {}, record);
  subscriptionSnapshot = result;
  const host = $('subscriptionList'), rows = result.data?.detail || [];
  host.replaceChildren(); host.className = 'subscriptions';
  text(host, 'p', `本次查询返回 ${rows.length} 个地址条目；不包含订阅人或相机信息。`);
  if (rows.length) subscriptionTable(host, rows); else text(host, 'p', '未查到订阅。');
  updateCancel(); return result;
}
function cancelTypes() {
  return [$('cancelTemperature').checked ? 192517 : null, $('cancelDifference').checked ? 192518 : null].filter(Boolean);
}
function updateCancel() {
  $('unsubscribe').disabled = !ready || !subscriptionSnapshot || !cancelTypes().length;
  $('confirmCancel').disabled = !$('confirmScope').checked || !cancelDraft;
}
async function prepareCancel() {
  const types = cancelTypes();
  if (!types.length) throw Error('请选择要取消的事件类型。');
  const result = await querySubscriptions();
  const rows = result.data.detail.filter(r => r.eventTypes.some(t => types.includes(Number(t))));
  if (!rows.length) throw Error('查询结果中没有所选事件类型，无需取消。');
  cancelDraft = {types, revision: result.workbenchRevision};
  $('cancelSummary').textContent = `将按事件类型取消：${types.map(t => eventName(t) + ' ' + t).join('、')}。以下 ${rows.length} 个地址条目包含这些类型：`;
  $('cancelTargets').replaceChildren(); subscriptionTable($('cancelTargets'), rows);
  $('confirmScope').checked = false; updateCancel(); $('cancelDialog').showModal();
}
async function confirmCancel() {
  if (!$('confirmScope').checked || !cancelDraft) throw Error('请确认取消范围。');
  const draft = cancelDraft;
  try {
    await call('unsubscribe', {eventTypes: draft.types}, {confirmed: true, subscriptionRevision: draft.revision});
    $('subscriptionState').textContent = '平台已确认取消所选事件类型';
    $('cancelDialog').close(); cancelDraft = null; subscriptionSnapshot = null;
    notice('已取消所选事件类型。历史回调保留；在途消息仍可能到达。');
    try { await querySubscriptions(false); } catch (error) { notice('取消已成功，但刷新列表失败：' + error.message, true); }
  } catch (error) {
    $('cancelDialog').close(); cancelDraft = null; subscriptionSnapshot = null;
    $('subscriptionList').textContent = '请重新查询订阅，核对实际状态后再操作。';
    throw error;
  }
}
async function subscribe() {
  if (!selected) throw Error('请先选择相机。');
  const eventDest = $('callback').value.trim(); let dest;
  try { dest = new URL(eventDest); } catch { throw Error('请填写完整的回调地址。'); }
  if (!['http:', 'https:'].includes(dest.protocol) || ['localhost','127.0.0.1','[::1]'].includes(dest.hostname)) {
    throw Error('回调必须是海康可达的接收服务器地址，不能使用 localhost。');
  }
  if (!info || dest.pathname !== info.callbackPath || dest.search || dest.hash) throw Error('请保留接收服务生成的回调路径，只调整 IP、协议和端口。');
  await call('subscribe', {eventTypes: $('diff').checked ? [192517,192518] : [192517], eventDest, subType: Number($('subType').value)});
  $('subscriptionState').textContent = '平台已确认订阅 · 等待真实报警';
  notice('订阅成功。尚不代表回调网络已连通，请用真实报警验证。');
  subscriptionSnapshot = null;
  try { await querySubscriptions(false); } catch (error) { notice('订阅已成功，但刷新列表失败：' + error.message, true); }
}
function formattedTime(value) {
  if (!value) return '未提供';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString('zh-CN', {hour12:false});
}
function previewImage(url, title) {
  $('previewTitle').textContent = title; $('previewImage').src = url;
  $('previewImage').alt = title; $('previewDownload').href = url;
  $('previewDownload').download = 'alarm-image'; $('previewDialog').showModal();
}
function addImages(parent, images) {
  const pair = text(parent, 'div', '', 'image-pair');
  for (const image of images) {
    const box = text(pair, 'div', '', 'image-box'); text(box, 'b', image.label);
    if (image.ready) {
      const img = document.createElement('img'); img.src = image.url; img.alt = image.label; img.loading = 'lazy'; box.append(img);
      const button = text(box, 'button', '放大预览'); button.onclick = () => previewImage(image.url, image.label); img.onclick = button.onclick;
      img.onerror = () => { img.remove(); text(box, 'p', '图片加载失败，请刷新或重新登录。'); };
    } else text(box, 'p', image.error || '正在获取图片…');
  }
}
const pushNames = {disabled:'推送未开启',filtered:'不在推送范围',pending:'等待推送',sending:'正在推送',sent:'已推送',failed:'推送失败',cancelled:'推送已取消'};
const provided = value => value != null && !['','未提供','未配置','未知相机','None','null'].includes(String(value).trim());
function makeCard(alarm) {
  const node = text(document.createDocumentFragment(), 'article', '', 'event');
  const title = text(node, 'div', '', 'event-title'); text(title, 'h3', alarm.sourceName);
  text(title, 'span', alarm.eventTypeName + (provided(alarm.level) ? ' · ' + alarm.level : ''), 'pill');
  if (provided(alarm.location)) text(node, 'p', alarm.location);
  const times = [];
  if (provided(alarm.happenTime)) times.push('发生时间 ' + formattedTime(alarm.happenTime));
  if (provided(alarm.received)) times.push('接收时间 ' + formattedTime(alarm.received));
  if (times.length) text(node, 'div', times.join(' · '), 'event-meta');
  if (alarm.ruleName) text(node, 'div', alarm.ruleName, 'event-meta');
  for (const m of alarm.measurements) if (m.value != null) {
    const unit = {0:'℃',1:'℉',3:'K'}[m.unit] || '';
    text(node, 'div', (m.quantity === 'temperature' ? '温度：' : '测温原值：') + m.value + unit
      + (m.threshold != null ? ' · 阈值：' + m.threshold + unit : ''), 'measure');
  }
  addImages(node, alarm.images);
  const actions = text(node, 'div', '', 'actions');
  text(actions, 'span', pushNames[alarm.pushState] || alarm.pushState, 'pill');
  const preview = text(actions, 'button', '飞书预览');
  preview.onclick = () => busy(preview, async () => {
    const result = await local('/api/card-preview', {alarmId:alarm.id});
    const host = $('cardPreview'); host.replaceChildren(); text(host,'h3',result.title);
    for (const [label,value] of result.fields) text(host,'div',label + '：' + (value || '未提供'));
    addImages(host,result.images); $('cardDialog').showModal();
  });
  if (['failed','cancelled'].includes(alarm.pushState)) {
    const retry = text(actions,'button','重试推送'); retry.onclick = () => busy(retry,async () => { await local('/api/push-retry',{alarmId:alarm.id}); await poll(true); });
  }
  if (alarm.images.some(i => i.error)) {
    const retry = text(actions,'button','重新获取图片'); retry.onclick = () => busy(retry,async () => { await local('/api/image-retry',{alarmId:alarm.id}); await poll(true); });
  }
  if (alarm.pushError) text(node,'p',alarm.pushError,'image-status error');
  const details = text(node,'details',''); text(details,'summary','原始事件');
  details.ontoggle = async () => {
    if (!details.open || details.dataset.loaded) return;
    try { const raw = await local('/api/alarms/' + alarm.id); text(details,'pre',JSON.stringify(raw,null,2),'raw'); details.dataset.loaded = '1'; }
    catch(error) { notice(error.message,true); }
  };
  return {node, fingerprint:JSON.stringify(alarm)};
}
function renderEvents() {
  const host = $('events'), fragment = document.createDocumentFragment(); let count = 0, images = 0;
  const query = $('eventSearch').value.trim().toLowerCase();
  for (const alarm of messages) {
    if ($('onlySelected').checked && (!selected || alarm.sourceCode !== selected.indexCode)) continue;
    if ($('eventTypeFilter').value && alarm.eventType !== $('eventTypeFilter').value) continue;
    if ($('hasImage').checked && !alarm.images.length) continue;
    if (query && ![alarm.sourceName,alarm.sourceCode,alarm.eventId,alarm.location].join(' ').toLowerCase().includes(query)) continue;
    count++; if (alarm.images.length) images++;
    if (cards.get(alarm.id)?.fingerprint !== JSON.stringify(alarm)) cards.set(alarm.id,makeCard(alarm));
    fragment.append(cards.get(alarm.id).node);
  }
  for (const id of cards.keys()) if (!messages.some(a => a.id === id)) cards.delete(id);
  host.replaceChildren(fragment); host.className = count ? '' : 'empty';
  if (!count) host.textContent = '暂无匹配报警。';
  $('matchedEvents').textContent = count; $('imageEvents').textContent = images;
  $('feedSummary').textContent = '每 3 秒刷新 · 同一报警的补图与状态更新自动合并';
}
async function poll(force = false) {
  if (!ready || polling) return; polling = true;
  try {
    const result = await local('/api/events'); messages = result.alarms;
    const next = JSON.stringify(messages);
    if (force || next !== signature) { signature = next; renderEvents(); }
    $('totalMessages').textContent = result.total;
    $('feedHealth').textContent = result.total ? '已接收回调' : '监听中'; $('feedHealth').className = 'tag ok';
  } catch (error) { $('feedHealth').textContent = '服务未连接'; $('feedHealth').className = 'tag'; if (force) notice(error.message,true); }
  finally { polling = false; }
}
function showSaved(settings) {
  savedSettings = settings;
  $('appSecret').value = ''; $('feishuSecret').value = '';
  $('appSecret').placeholder = settings.hik.secretSaved ? '已保存，留空不修改' : '输入海康密钥';
  $('feishuSecret').placeholder = settings.feishu.secretSaved ? '已保存，留空不修改' : '输入飞书应用密钥';
  $('pushEnabled').checked = settings.feishu.enabled;
  $('pushStatus').textContent = settings.feishu.enabled ? '已开启' : '已关闭';
  $('pushStatus').className = settings.feishu.enabled ? 'tag ok' : 'tag';
  $('disablePush').disabled = !settings.feishu.enabled;
  $('saveState').textContent = '配置已保存';
  $('testResult').textContent = testConfigSaved() ? '配置已保存，可发送测试图文；自动推送关闭时也可测试。' : '请填写并保存飞书配置后发送测试。';
  updateTestButton();
}
function testConfigSaved() {
  const f = savedSettings?.feishu;
  return ready && f?.appId && f?.secretSaved && f?.receiveId && !$('feishuSecret').value
    && $('feishuAppId').value.trim() === f.appId && $('feishuBase').value.trim() === f.baseUrl
    && $('receiveIdType').value === f.receiveIdType && $('receiveId').value.trim() === f.receiveId;
}
function updateTestButton() {
  $('testFeishu').disabled = !testConfigSaved();
}
for (const id of ['feishuAppId','feishuSecret','feishuBase','receiveIdType','receiveId']) {
  $(id).addEventListener('input', () => { updateTestButton(); $('testResult').textContent = '配置已更改，请保存后再发送测试。'; });
  $(id).addEventListener('change', updateTestButton);
}
$('testFeishu').onclick = () => busy($('testFeishu'), async () => {
  if (!testConfigSaved()) throw Error('请先保存飞书配置，再发送测试。');
  $('testResult').textContent = '正在上传测试图片并发送图文消息…';
  try {
    const result = await local('/api/feishu-test', {});
    $('testResult').textContent = `测试图文已发送至 ${result.receiveId} · 消息 ID：${result.messageId}`;
    notice('飞书已返回发送成功，请在接收会话中核对文字和图片。');
  } catch (error) { $('testResult').textContent = '测试发送失败：' + error.message; throw error; }
});
async function saveSettings() {
  const settings = await local('/api/settings', {
    hik:{platform:$('platform').value.trim(),appKey:$('appKey').value.trim(),appSecret:$('appSecret').value,insecure:$('insecure').checked,subType:Number($('subType').value),includeDifference:$('diff').checked},
    camera:{indexCode:selected?.indexCode || '',name:selected?.name || '',location:$('cameraLocation').value.trim()},
    callbackUrl:$('callback').value.trim(),
    feishu:{enabled:$('pushEnabled').checked,baseUrl:$('feishuBase').value.trim(),appId:$('feishuAppId').value.trim(),appSecret:$('feishuSecret').value,
      receiveIdType:$('receiveIdType').value,receiveId:$('receiveId').value.trim(),allCameras:$('allCameras').checked}
  });
  showSaved(settings); notice('配置已保存。');
}
$('saveSettings').onclick = () => busy($('saveSettings'),saveSettings);
$('disablePush').onclick = () => busy($('disablePush'),async () => { showSaved(await local('/api/push-toggle',{enabled:false})); notice('飞书推送已关闭。'); await poll(true); });
$('closeCard').onclick = () => $('cardDialog').close();
$('toggleSecret').onclick = () => {
  const show = $('appSecret').type === 'password'; $('appSecret').type = show ? 'text' : 'password';
  $('toggleSecret').textContent = show ? '隐藏' : '显示'; $('toggleSecret').setAttribute('aria-label', show ? '隐藏密钥' : '显示密钥');
};
$('search').onclick = () => busy($('search'), () => search(1,true));
$('cameraName').onkeydown = e => { if (e.key === 'Enter' && !$('search').disabled) $('search').click(); };
$('prev').onclick = () => busy($('prev'), () => search(page-1)).then(renderCameras);
$('next').onclick = () => busy($('next'), () => search(page+1)).then(renderCameras);
for (const id of ['platform','appKey','appSecret']) $(id).addEventListener('input', () => {
  resetSelection(); cameras = []; lastQuery = null; total = 0; page = 1; subscriptionSnapshot = null; cancelDraft = null;
  $('cameraRows').replaceChildren(); $('cameras').classList.add('hidden'); $('cameraEmpty').classList.remove('hidden');
  $('cameraEmpty').textContent = '平台或密钥已更改，请重新查询。'; $('subscriptionList').textContent = '平台或密钥已更改，请重新查询订阅。';
  $('prev').disabled = true; $('next').disabled = true; $('pageInfo').textContent = '尚未查询'; updateCancel();
});
$('viewSubscriptions').onclick = () => busy($('viewSubscriptions'), async () => { await querySubscriptions(); notice('已刷新订阅列表。'); });
$('subscribe').onclick = () => busy($('subscribe'), subscribe);
$('unsubscribe').onclick = () => busy($('unsubscribe'), prepareCancel);
$('confirmCancel').onclick = () => busy($('confirmCancel'), confirmCancel);
for (const id of ['cancelTemperature','cancelDifference','confirmScope']) $(id).onchange = updateCancel;
$('closeCancel').onclick = () => $('cancelDialog').close();
$('cancelDialog').addEventListener('close', () => { cancelDraft = null; $('confirmScope').checked = false; updateCancel(); });
$('closePreview').onclick = () => $('previewDialog').close();
$('previewDialog').addEventListener('close', () => $('previewImage').removeAttribute('src'));
$('refresh').onclick = () => poll(true);
for (const id of ['onlySelected','eventTypeFilter','hasImage']) $(id).onchange = renderEvents;
$('eventSearch').oninput = renderEvents;
$('logout').onclick = () => busy($('logout'), async () => { await local('/api/logout', {}); $('appSecret').value = ''; location.reload(); });
async function init() {
  if (!['http:','https:'].includes(location.protocol) || token === '__WORKBENCH_TOKEN__') { showOffline(); return; }
  try {
    info = await local('/api/info'); ready = true;
    const settings = await local('/api/settings');
    for (const [id,value] of Object.entries({platform:settings.hik.platform,appKey:settings.hik.appKey,subType:settings.hik.subType,
      cameraLocation:settings.camera.location,feishuAppId:settings.feishu.appId,feishuBase:settings.feishu.baseUrl,
      receiveIdType:settings.feishu.receiveIdType,receiveId:settings.feishu.receiveId})) $(id).value = value;
    $('insecure').checked = settings.hik.insecure; $('diff').checked = settings.hik.includeDifference; $('allCameras').checked = settings.feishu.allCameras;
    if (settings.camera.indexCode) {
      selected = settings.camera; $('selectedCamera').textContent = '已保存：' + selected.name + ' · ' + selected.indexCode;
      $('subscribe').disabled = false;
      $('subscriptionState').textContent = '已恢复保存的相机';
    } else $('onlySelected').checked = false;
    showSaved(settings);
    $('health').textContent = '接收服务已连接'; $('health').className = 'tag ok';
    $('logout').classList.toggle('hidden', !info.remoteAdmin);
    $('callback').value = info.callbackUrl || settings.callbackUrl || `http://${info.ips[0] || '<接收服务器IP>'}:${info.port}${info.callbackPath}`;
    $('callbackHint').textContent = info.callbackUrl ? '服务器回调地址，保留此路径。' : `保留路径 ${info.callbackPath}。服务端候选 IP：${info.ips.join('、') || '请手动填写'}；监听端口 ${info.port}。`;
    await poll(true); setInterval(() => poll(), 3000); updateCancel();
  } catch { showOffline(); }
}
function showOffline() {
  $('startup').classList.remove('hidden'); $('health').textContent = '服务未连接，请确认启动或重新登录';
  for (const id of ['search','viewSubscriptions','subscribe','unsubscribe','refresh']) $(id).disabled = true;
}
init();
