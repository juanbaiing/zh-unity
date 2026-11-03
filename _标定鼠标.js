// 标定：真实鼠标的物理坐标 ↔ 页面里的 CSS 坐标
// SetCursorPos 用物理像素，getBoundingClientRect 用 CSS 像素，中间差一个缩放和原点。
// 直接量，不靠推。
const http = require('http');
const { execFileSync } = require('child_process');

const 端口 = 9222;
const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';

function 要(p) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${p}`, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => 好(b)); }).on('error', 坏);
  });
}
const 等一秒 = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const 列表 = JSON.parse(await 要('/json/list'));
  const 页 = 列表.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 等 = new Map(); let 号 = 0;
  const 调用 = (method, params = {}) => new Promise((好, 坏) => {
    const id = ++号; 等.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 等.has(m.id)) { const { 好, 坏 } = 等.get(m.id); 等.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  const 算 = async (式) => (await 调用('Runtime.evaluate', { expression: 式, returnByValue: true })).result.value;

  await 算(`
    window.__标 = { cx: -1, cy: -1, sx: -1, sy: -1, 次数: 0 };
    if (!window.__标装) {
      window.__标装 = 1;
      window.addEventListener('mousemove', e => {
        window.__标.cx = e.clientX; window.__标.cy = e.clientY;
        window.__标.sx = e.screenX; window.__标.sy = e.screenY;
        window.__标.次数++;
      }, true);
    }
    'ok'
  `);

  const 点们 = [[200, 200], [1200, 700], [900, 450]];
  const 结果 = [];
  for (const [px, py] of 点们) {
    try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, '移', String(px), String(py)], { stdio: 'ignore' }); } catch (e) { }
    await 等一秒(300);
    const o = JSON.parse(await 算('JSON.stringify(window.__标)'));
    结果.push({ 物理: [px, py], css: [o.cx, o.cy], 屏报: [o.sx, o.sy], 次数: o.次数 });
    console.log(`物理(${px},${py})  →  CSS(${o.cx},${o.cy})   screenX/Y=(${o.sx},${o.sy})   累计mousemove=${o.次数}`);
  }

  const [a, b] = 结果;
  if (a.css[0] >= 0 && b.css[0] >= 0) {
    const kx = (b.物理[0] - a.物理[0]) / (b.css[0] - a.css[0]);
    const ky = (b.物理[1] - a.物理[1]) / (b.css[1] - a.css[1]);
    const ox = a.物理[0] - a.css[0] * kx;
    const oy = a.物理[1] - a.css[1] * ky;
    console.log(`\n换算：物理 = CSS × k + 原点`);
    console.log(`  kx=${kx.toFixed(4)}  ky=${ky.toFixed(4)}`);
    console.log(`  原点(物理) = (${ox.toFixed(1)}, ${oy.toFixed(1)})`);
    console.log(`  反向：CSS = (物理 − 原点) / k`);
    const t = [600, 600];
    console.log(`  校验 物理(600,600) ⇒ CSS(${((t[0] - ox) / kx).toFixed(1)}, ${((t[1] - oy) / ky).toFixed(1)})`);
  } else {
    console.log('\n⚠ 页面没收到 mousemove —— 鼠标没落在页面里，或窗口不在前台');
  }
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
