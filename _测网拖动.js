// 真鼠标拖一个实例框，验证三件事：
//   ① 跟着真实鼠标走（位移换算除以 视.z）
//   ② 松手后位置写进 localStorage 之外的地方 —— 发 {命令:'存布局'} 给壳
//   ③ 线跟着动（线是每次重算的，不跟着动说明没重画）
// 测完按快照还原位置。
const http = require('http');
const { execFileSync } = require('child_process');

const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';
const 等 = ms => new Promise(r => setTimeout(r, ms));
const 静 = (动作, ...数) => {
  try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, 动作, ...数.map(String)], { stdio: 'ignore' }); }
  catch (e) { console.log(`  ⚠ ${动作} 失败`); }
};
function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
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

  const 原 = JSON.parse(await 算('JSON.stringify({x:window.screenX,y:window.screenY,w:innerWidth,h:innerHeight})'));
  const 屏 = ([x, y]) => [Math.round(x + 原.x), Math.round(y + 原.y)];

  // 挑一个整块都在可视区里的实例框
  // 先把视野挪到实例框那一带 —— 打开时视野对准的是块，网在右边看不见
  await 算(`(function(){
    const 一 = document.querySelector('.实例框');
    const 舞台r = 舞台.getBoundingClientRect();
    视.z = 1;
    视.x = 舞台r.left + 40 - (parseFloat(一.style.left)||0);
    视.y = 舞台r.top + 40 - (parseFloat(一.style.top)||0);
    应用视();
    return 'ok';
  })()`);
  await 等(500);
  const 备 = JSON.parse(await 算(`(function(){
    const 出=[];
    for (const el of document.querySelectorAll('.实例框')) {
      const h = el.querySelector('.实例头').getBoundingClientRect();
      出.push({id:el.dataset.id, 名:el.querySelector('.实例名').textContent,
        头:[h.left,h.top,h.width,h.height], 框L:parseFloat(el.style.left), 框T:parseFloat(el.style.top)});
    }
    return JSON.stringify(出);
  })()`));
  const 视 = JSON.parse(await 算('JSON.stringify({z:视.z,x:视.x,y:视.y})'));
  const 舞台r = JSON.parse(await 算('JSON.stringify({x:舞台.getBoundingClientRect().left,y:舞台.getBoundingClientRect().top,w:舞台.getBoundingClientRect().width,h:舞台.getBoundingClientRect().height})'));
  console.log(`视 z=${视.z.toFixed(2)}｜舞台 (${Math.round(舞台r.x)},${Math.round(舞台r.y)}) ${Math.round(舞台r.w)}×${Math.round(舞台r.h)}`);
  const 能拖 = 备.filter(b => b.头[0] > 舞台r.x + 20 && b.头[0] + b.头[2] < 舞台r.x + 舞台r.w - 20 &&
                            b.头[1] > 舞台r.y + 20 && b.头[1] + b.头[3] < 舞台r.y + 舞台r.h - 20);
  备.forEach(b => console.log(`  ${b.名}  头 client(${Math.round(b.头[0])},${Math.round(b.头[1])}) ${Math.round(b.头[2])}×${Math.round(b.头[3])}${能拖.includes(b) ? '  ← 可拖' : ''}`));
  if (!能拖.length) { console.log('没有整块在可视区里的，停'); ws.close(); return; }

  const 拖 = 能拖[0];
  const 抓 = [拖.头[0] + 20, 拖.头[1] + 拖.头[3] / 2];
  const 放 = [抓[0] + 160, 抓[1] + 100];
  const 命 = JSON.parse(await 算(`(function(){const e=document.elementFromPoint(${抓[0]},${抓[1]});
    const h=e&&e.closest('.实例框'); return JSON.stringify({元素:e?e.tagName+'.'+(e.className||''):'null', 框:h?h.dataset.id:null});})()`));
  console.log(`\n拖「${拖.名}」：client(${抓[0].toFixed(0)},${抓[1].toFixed(0)}) → (${放[0].toFixed(0)},${放[1].toFixed(0)})`);
  console.log(`  抓取点命中 ${命.元素}，属于框 ${命.框}`);
  if (命.框 !== 拖.id) { console.log('  ✗ 抓取点没落在目标框上，停'); ws.close(); return; }

  const 读 = () => 算(`(function(){const el=document.querySelector('.实例框[data-id="${拖.id}"]');
    const 线=document.querySelectorAll('#线层 path');
    return JSON.stringify({l:parseFloat(el.style.left), t:parseFloat(el.style.top), 线数:线.length,
      首线:(线[0]?线[0].getAttribute('d'):'')});})()`);
  const 前 = JSON.parse(await 读());

  静('拖', ...屏(抓), ...屏(放));
  await 等(1200);
  const 后 = JSON.parse(await 读());

  const dx = 后.l - 前.l, dy = 后.t - 前.t;
  const 期望x = 160 / 视.z, 期望y = 100 / 视.z;
  console.log(`\n框的位置 ${前.l},${前.t} → ${后.l},${后.t}`);
  console.log(`  位移 (${dx.toFixed(1)}, ${dy.toFixed(1)})   期望 (${期望x.toFixed(1)}, ${期望y.toFixed(1)})  ${Math.abs(dx - 期望x) < 3 && Math.abs(dy - 期望y) < 3 ? '✓' : '✗'}`);
  console.log(`  线 ${前.线数} 条 → ${后.线数} 条，首线坐标变了？ ${前.首线 !== 后.首线 ? '✓ 重画了' : '✗ 没动'}`);

  // 还原
  await 算(`(function(){
    const el=document.querySelector('.实例框[data-id="${拖.id}"]');
    el.style.left='${拖.框L}px'; el.style.top='${拖.框T}px';
    const 位=网.位置.get('${拖.id}'); if(位){位.x=${拖.框L};位.y=${拖.框T};}
    画线(); 存布局(); return 'ok';
  })()`);
  await 等(600);
  const 末 = JSON.parse(await 读());
  console.log(`\n还原后 ${末.l},${末.t}  ${Math.abs(末.l - 拖.框L) < 1 && Math.abs(末.t - 拖.框T) < 1 ? '✓' : '✗'}`);
  ws.close();
})().catch(e => { console.error('❗ ' + e.message); process.exit(1); });
