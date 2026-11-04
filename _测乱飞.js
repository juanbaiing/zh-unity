// 复现「内部代码块和外部的会乱飞」。
// 全程真鼠标（SetCursorPos + mouse_event，已修好抢前台）。
//
// 场景：
//  A. 开窗后拖【内部块】—— 验 数据位移 == 屏幕位移 ÷ (视.z × 内视.z)
//  B. 开窗后拖【外部实例框】—— 里面的块应该跟着一起走，且块数据坐标不该变
//  C. 相邻两次拖动（先内后外、先外后内）—— 看第二次是不是接管了第一次的坐标系
// 每个场景测完都还原，不留下被拖乱的存档。
const http = require('http');
const { execFileSync } = require('child_process');
const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';
const 等 = ms => new Promise(r => setTimeout(r, ms));
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
  const 原 = JSON.parse(await 算('JSON.stringify({x:window.screenX,y:window.screenY})'));
  const 屏 = ([x, y]) => [Math.round(x + 原.x), Math.round(y + 原.y)];
  const 拖 = (a, b) => { try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, '拖', ...屏(a).map(String), ...屏(b).map(String)], { stdio: 'ignore' }); } catch (e) { console.log('  ⚠ 拖失败'); } };
  const 命中 = async (p) => JSON.parse(await 算(`(function(){const e=document.elementFromPoint(${p[0]},${p[1]});
    if(!e) return JSON.stringify({元素:'null',块:null,实例:null});
    const b=e.closest('.blk'), i=e.closest('.实例框');
    return JSON.stringify({元素:e.tagName+'.'+(e.className||''), 块:b?b.dataset.id:null, 实例:i?i.dataset.id:null});})()`));

  // ── 开窗并把内视归位到左上角，块完整可见 ──
  await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    if (窗.el) 关窗();
    视.z=2;
    视.x=舞台.getBoundingClientRect().left+20-parseFloat(实.style.left)*视.z;
    视.y=舞台.getBoundingClientRect().top+20-parseFloat(实.style.top)*视.z;
    应用视();
    开窗(实,'PlayerAttack'); 装窗缩放();
    return 'ok';
  })()`);
  await 等(1200);
  await 算(`(function(){ 窗.内视={x:16,y:16,z:窗.内视.z}; 应用内视(); return 'ok'; })()`);
  await 等(400);

  const 态 = async () => JSON.parse(await 算(`(function(){
    const b=窗.内.querySelector(':scope > .blk');
    const 头=b.querySelector(':scope > .head').getBoundingClientRect();
    const w=窗.el.getBoundingClientRect();
    let 数据=null; const id=b.dataset.id;
    (function 找(l){for(const x of l||[]){ if(String(x.id)===id) 数据={x:x.x,y:x.y}; 找(x.子); for(const s of x.分支||[]) 找(s.子);} })(根块们);
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    return JSON.stringify({
      块id:b.dataset.id, 头:[头.left+头.width/2, 头.top+头.height/2],
      块数据:数据, 块style:[parseFloat(b.style.left),parseFloat(b.style.top)],
      窗:[w.left,w.top,w.width,w.height],
      实框left:parseFloat(实.style.left), 实框top:parseFloat(实.style.top),
      外层:视.z, 内层:窗.内视.z, 总:(视.z*窗.内视.z)
    });
  })()`));

  const A = await 态();
  console.log(`起点：块 ${A.块id}  数据(${A.块数据.x.toFixed(1)},${A.块数据.y.toFixed(1)})  外层${A.外层} 内层${A.内层.toFixed(3)} 总${A.总.toFixed(3)}`);
  console.log(`  块头屏幕 (${A.头[0].toFixed(0)},${A.头[1].toFixed(0)})  窗户屏幕 ${A.窗.map(Math.round).join(',')}`);

  // ── A. 拖内部块 ──
  const 命A = await 命中(A.头);
  console.log(`\nA 拖内部块：抓 (${A.头[0].toFixed(0)},${A.头[1].toFixed(0)}) 命中 ${命A.元素} 块=${命A.块}`);
  if (命A.块 === A.块id) {
    const 放 = [A.头[0] + 100, A.头[1] + 60];
    拖(A.头, 放);
    await 等(900);
    const B = await 态();
    const dx = B.块数据.x - A.块数据.x, dy = B.块数据.y - A.块数据.y;
    const 期望x = 100 / A.总, 期望y = 60 / A.总;
    console.log(`  数据 (${A.块数据.x.toFixed(1)},${A.块数据.y.toFixed(1)}) → (${B.块数据.x.toFixed(1)},${B.块数据.y.toFixed(1)})`);
    console.log(`  位移 (${dx.toFixed(1)},${dy.toFixed(1)})  期望 (${期望x.toFixed(1)},${期望y.toFixed(1)})  ${Math.abs(dx-期望x)<5&&Math.abs(dy-期望y)<5?'✓':'✗ 乱飞'}`);
    console.log(`  块 style (${B.块style.map(v=>v.toFixed(1)).join(',')})  —— 跟数据一致才算对 ${Math.abs(B.块style[0]-B.块数据.x)<1&&Math.abs(B.块style[1]-B.块数据.y)<1?'✓':'✗ 数据和显示脱节'}`);
  } else {
    console.log('  ✗ 抓不到块头，跳过');
  }

  // ── B. 拖外部实例框，里面的块该跟着走、数据不该变 ──
  const C = await 态();
  const 实头 = JSON.parse(await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    const r=实.getBoundingClientRect();
    return JSON.stringify({p:[r.left+60,r.top+20], left:parseFloat(实.style.left), top:parseFloat(实.style.top)});
  })()`));
  const 命B = await 命中(实头.p);
  console.log(`\nB 拖外部实例框：抓 (${实头.p[0].toFixed(0)},${实头.p[1].toFixed(0)}) 命中 ${命B.元素} 实例=${命B.实例}`);
  if (命B.实例) {
    const 放 = [实头.p[0] - 80, 实头.p[1] + 40];
    拖(实头.p, 放);
    await 等(900);
    const D = await 态();
    console.log(`  实例框 left/top ${C.实框left.toFixed(0)},${C.实框top.toFixed(0)} → ${D.实框left.toFixed(0)},${D.实框top.toFixed(0)}`);
    console.log(`  块数据 ${C.块数据.x.toFixed(1)},${C.块数据.y.toFixed(1)} → ${D.块数据.x.toFixed(1)},${D.块数据.y.toFixed(1)}  ${Math.abs(D.块数据.x-C.块数据.x)<1&&Math.abs(D.块数据.y-C.块数据.y)<1?'✓ 没被带走':'✗ 块的数据跟着变了（乱飞的一种）'}`);
    console.log(`  块还在窗户里吗 ${D.块id===C.块id?'✓':'✗ 块换了'}`);
  } else {
    console.log('  ✗ 没抓到实例框头');
  }

  // ── C. 再来一次内部拖：看是不是被上一次外部拖接管了坐标系 ──
  const E = await 态();
  const 命C = await 命中(E.头);
  console.log(`\nC 连续拖（外部刚拖完又拖内部）：抓 (${E.头[0].toFixed(0)},${E.头[1].toFixed(0)}) 命中 ${命C.元素} 块=${命C.块}`);
  if (命C.块 === E.块id) {
    const 放 = [E.头[0] - 70, E.头[1] - 40];
    拖(E.头, 放);
    await 等(900);
    const F = await 态();
    const dx = F.块数据.x - E.块数据.x, dy = F.块数据.y - E.块数据.y;
    const 期望x = -70 / E.总, 期望y = -40 / E.总;
    console.log(`  位移 (${dx.toFixed(1)},${dy.toFixed(1)})  期望 (${期望x.toFixed(1)},${期望y.toFixed(1)})  ${Math.abs(dx-期望x)<5&&Math.abs(dy-期望y)<5?'✓':'✗ 乱飞'}`);
    console.log(`  外层${F.外层} 内层${F.内层.toFixed(3)}  窗户屏幕 ${F.窗.map(Math.round).join(',')}`);
  } else {
    console.log('  ✗ 抓不到块');
  }
  ws.close();
})().catch(e => { console.error('❗ ' + e.message); process.exit(1); });
