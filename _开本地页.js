// 让 WebView2 打开一个本地 html，等它渲染完，截图，再回到编辑器。
// 用法: node _开本地页.js file路径 输出图
const http = require('http');
const fs = require('fs');
const path = require('path');

function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
  const [文件, 出图] = process.argv.slice(2);
  const 列0 = JSON.parse(await 要('/json/list'));
  const ws = new WebSocket(列0.find(t => t.type === 'page' && t.webSocketDebuggerUrl).webSocketDebuggerUrl);
  const 待 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => { const id = ++号; 待.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 待.has(m.id)) { const { 好, 坏 } = 待.get(m.id); 待.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  await 调用('Page.enable');

  const 地址 = 'file:///' + 文件.replace(/\\/g, '/');
  await 调用('Page.navigate', { url: 地址 });
  await new Promise(r => setTimeout(r, 2500));

  const r = await 调用('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const 目录 = path.dirname(出图);
  if (!fs.existsSync(目录)) fs.mkdirSync(目录, { recursive: true });
  fs.writeFileSync(出图, Buffer.from(r.data, 'base64'));
  console.log(`截图 ${出图}  ${fs.statSync(出图).size} 字节`);

  // 回到编辑器
  await 调用('Page.navigate', { url: 'https://zh.editor/index.html' });
  await new Promise(r => setTimeout(r, 1500));
  console.log('已回到编辑器');
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
