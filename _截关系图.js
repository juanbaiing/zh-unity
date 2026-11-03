// 打开关系图，截两张：默认（远档，看全貌）+ 放大到能读（中/近档），然后回编辑器。
// 用法: node _截关系图.js 文件路径 前缀
const http = require('http');
const fs = require('fs');
const path = require('path');
function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
  const [文件, 前缀] = process.argv.slice(2);
  const 列 = JSON.parse(await 要('/json/list'));
  const ws = new WebSocket(列.find(t => t.type === 'page' && t.webSocketDebuggerUrl).webSocketDebuggerUrl);
  const 待 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => { const id = ++号; 待.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 待.has(m.id)) { const { 好, 坏 } = 待.get(m.id); 待.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  const 算 = async 式 => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true });
    if (r.exceptionDetails) throw new Error('❗' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const 截 = async 名 => {
    const r = await 调用('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const 出 = 前缀 + 名 + '.png';
    fs.writeFileSync(出, Buffer.from(r.data, 'base64'));
    const 态 = await 算(`JSON.stringify({档:算档(), 字:+屏幕字号().toFixed(1), 视w:Math.round(视.w)})`);
    console.log(`${出}  ${JSON.parse(态).档}档 ${JSON.parse(态).字}px  视宽${JSON.parse(态).视w}`);
  };

  await 调用('Page.enable');
  await 调用('Page.navigate', { url: 'file:///' + 文件.replace(/\\/g, '/') });
  await new Promise(r => setTimeout(r, 2200));

  await 截('-远档');

  // 放大到「屏幕字号 ≈ 13px」—— 那是能读清数据槽的尺度
  await 算(`(function(){
    const 屏宽 = 画布.getBoundingClientRect().width;
    视.w = 屏宽 / (13 / 正文字号); 视.h = 视.w * (画布.getBoundingClientRect().height / 屏宽);
    视.x = 原点.x + (原点.w - 视.w) / 2; 视.y = 原点.y + (原点.h - 视.h) / 2;
    应用视();
    return 'ok';
  })()`);
  await new Promise(r => setTimeout(r, 900));
  await 截('-近档');

  await 调用('Page.navigate', { url: 'https://zh.editor/index.html' });
  await new Promise(r => setTimeout(r, 1200));
  console.log('已回到编辑器');
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
