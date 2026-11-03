// 放大截局部：把画布缩放调到指定值，再只截画布那一片。
// 用法: node _截画布.js 输出文件 [缩放]
const http = require('http');
const fs = require('fs');
const path = require('path');
const 出 = process.argv[2] || 'D:/dswork/_截图/画布.png';
const 缩放 = process.argv[3] ? Number(process.argv[3]) : null;

function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
  const 列 = JSON.parse(await 要('/json/list'));
  const 页 = 列.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 待 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => { const id = ++号; 待.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 待.has(m.id)) { const { 好, 坏 } = 待.get(m.id); 待.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  const 算 = async 式 => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true });
    if (r.exceptionDetails) throw new Error('❗' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  await 调用('Page.enable');

  if (缩放) { await 算(`视.z=${缩放};应用视();对准块();'ok'`); await new Promise(r => setTimeout(r, 700)); }

  const 框 = JSON.parse(await 算(`(function(){
    const r = 舞台.getBoundingClientRect();
    return JSON.stringify({x:r.left, y:r.top, width:r.width, height:r.height});
  })()`));

  const r = await 调用('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    clip: { x: 框.x, y: 框.y, width: 框.width, height: 框.height, scale: 1 },
  });
  const 目录 = path.dirname(出);
  if (!fs.existsSync(目录)) fs.mkdirSync(目录, { recursive: true });
  fs.writeFileSync(出, Buffer.from(r.data, 'base64'));
  console.log(`${出}  ${fs.statSync(出).size} 字节  区域 ${框.width.toFixed(0)}×${框.height.toFixed(0)}`);
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
