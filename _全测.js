// 完整回归：把所有已知功能一遍跑完，一条一条给 ✓ / ✗。
// 全程真鼠标（SetCursorPos + mouse_event + keybd_event，已修好抢前台）。
// 每个会改数据的步骤都拍快照，跑完还原 —— 不留坏坐标。
const http = require('http');
const { execFileSync } = require('child_process');
const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';
const 等 = ms => new Promise(r => setTimeout(r, ms));
const 静 = (动作, ...数) => { try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, 动作, ...数.map(String)], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

const 结 = [];
const 记 = (名, 过, 数 = '') => { 结.push({ 名, 过 }); console.log(`  ${过 ? '✓' : '✗'} ${名}${数 ? '  — ' + 数 : ''}`); };

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
  const 命中 = async (p) => JSON.parse(await 算(`(function(){const e=document.elementFromPoint(${p[0]},${p[1]});
    if(!e) return JSON.stringify({元素:'null',块:null,实例:null});
    const b=e.closest('.blk'), i=e.closest('.实例框');
    return JSON.stringify({元素:e.tagName+'.'+(e.className||''), 块:b?b.dataset.id:null, 实例:i?i.dataset.id:null});})()`));

  // ══ 快照：所有工程的块坐标，跑完还原 ══
  const 快照 = JSON.parse(await 算(`(function(){ const 出=[];
    for (const 名 of Object.keys(工程表)) { const 块=[];
      (function 走(l){ for (const x of l||[]) { 块.push({id:x.id,x:x.x,y:x.y}); 走(x.子); for (const s of x.分支||[]) 走(s.子); } })(工程表[名].块们||[]);
      出.push({名, 块}); }
    return JSON.stringify(出); })()`));

  console.log('\n════ 1. 起手状态 ════');
  const 开 = JSON.parse(await 算(`JSON.stringify({
    块:document.querySelectorAll('.blk').length, 实例框:document.querySelectorAll('.实例框').length,
    线:document.querySelectorAll('#线层 path').length, 网开:网.开, 窗外层:视.z,
    有壳:有壳(), 生成行:(function(){try{return 树.生成CSharp(根块们).split('\\n').length}catch(e){return -1}})()
  })`));
  // 默认界面是关系网，块是窗户里的内容 —— 没开窗时块为 0 才是对的
  记('默认只显示关系网，块不摊出来', 开.块 === 0, 开.块 + ' 块摊在外面');
  记('网层有实例框', 开.实例框 > 0, 开.实例框 + ' 个');
  记('连线画出来了', 开.线 > 0, 开.线 + ' 条 path');
  记('生成 C# 不报错', 开.生成行 > 0, 开.生成行 + ' 行');

  console.log('\n════ 2. 外层缩放（真鼠标滚轮）════');
  await 算(`(function(){ 视.z=1; 应用视(); window.__外=0; 舞台.addEventListener('wheel',()=>{window.__外++},{passive:true}); return 'ok'; })()`);
  const z0 = await 算('视.z');
  静('滚', ...屏([300, 300]), 3);
  await 等(500);
  const z1 = await 算('视.z');
  记('滚轮放大外层', z1 > z0, `${z0.toFixed(2)} → ${z1.toFixed(2)}（期望 ×1.12³=1.405）`);
  记('页面确实收到 wheel 事件', (await 算('window.__外')) > 0, (await 算('window.__外')) + ' 个');

  console.log('\n════ 3. 开窗 ════');
  await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    if (窗.el) 关窗();
    视.z=3;
    视.x=舞台.getBoundingClientRect().left+20-parseFloat(实.style.left)*视.z;
    视.y=舞台.getBoundingClientRect().top+20-parseFloat(实.style.top)*视.z;
    应用视(); 开窗(实,'PlayerAttack'); 装窗缩放(); return 'ok';
  })()`);
  await 等(1300);
  const W = JSON.parse(await 算(`(function(){
    const w=窗.el, r=w.getBoundingClientRect(), b=窗.内.querySelector(':scope > .blk');
    let 右=0; for(const el of 窗.内.querySelectorAll(':scope > .blk')) 右=Math.max(右,(parseFloat(el.style.left)||0)+el.offsetWidth);
    const rb=b?b.getBoundingClientRect():null;
    返回=null;
    return JSON.stringify({有窗:!!w, 内视:窗.内视.z, 窗:[r.left,r.top,r.width,r.height],
      块数:窗.内.querySelectorAll('.blk').length, 顶层块右:Math.round(右),
      窗CSS宽:w.offsetWidth, 可见域:w.offsetWidth/窗.内视.z,
      首块屏:rb?[Math.round(rb.left),Math.round(rb.top),Math.round(rb.width)]:null});
  })()`));
  记('窗户建出来了', W.有窗);
  记('块渲染进窗户', W.块数 > 0, W.块数 + ' 块');
  记('块在窗户可见域内（不飞）', W.顶层块右 <= W.可见域 + 1, `块右 ${W.顶层块右} vs 可见域 ${Math.round(W.可见域)}`);
  const 块在窗内 = W.首块屏 && W.首块屏[0] >= W.窗[0] - 2 && W.首块屏[0] < W.窗[0] + W.窗[2] + 2;
  记('首块屏幕位置落在窗户里', 块在窗内, W.首块屏 ? `块 ${W.首块屏[0]} 窗 ${Math.round(W.窗[0])}~${Math.round(W.窗[0] + W.窗[2])}` : '-');

  console.log('\n════ 4. 窗户内缩放 vs 外层 ════');
  const 窗心 = [W.窗[0] + W.窗[2] / 2, W.窗[1] + Math.min(200, W.窗[3] / 2)];
  const 内0 = await 算('窗.内视.z'), 外0 = await 算('视.z');
  静('滚', ...屏(窗心), 3);
  await 等(500);
  const 内1 = await 算('窗.内视.z'), 外1 = await 算('视.z');
  记('窗户里滚 → 内层放大', 内1 > 内0, `${内0.toFixed(3)} → ${内1.toFixed(3)}`);
  记('窗户里滚 → 外层不动', Math.abs(外1 - 外0) < 1e-9, `外层 ${外0}`);

  console.log('\n════ 5. Shift+滚 → 缩外层 ════');
  const 外a = await 算('视.z'), 内a = await 算('窗.内视.z');
  静('滚', ...屏(窗心), 2, 1);   // 第 5 个参数 1 = 按住 Shift
  await 等(500);
  const 外b = await 算('视.z'), 内b = await 算('窗.内视.z');
  记('Shift+滚 → 外层放大', 外b > 外a, `${外a.toFixed(3)} → ${外b.toFixed(3)}`);
  记('Shift+滚 → 内层不动', Math.abs(内b - 内a) < 1e-9, `内层 ${内a.toFixed(3)}`);

  console.log('\n════ 6. 拖内部块（坐标换算）════');
  await 算(`(function(){
    关窗();
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    // 视野必须重置 —— 前面几轮缩放把块推出视口了，不重置的话抓点落空
    视.z=3;
    视.x=舞台.getBoundingClientRect().left+20-parseFloat(实.style.left)*视.z;
    视.y=舞台.getBoundingClientRect().top+20-parseFloat(实.style.top)*视.z;
    应用视();
    开窗(实,'PlayerAttack'); 装窗缩放();
    return 'ok'; })()`);
  await 等(1000);
  await 算(`(function(){ 窗.内视={x:16,y:16,z:窗.内视.z}; 应用内视(); return 'ok'; })()`);
  await 等(400);
  const B0 = JSON.parse(await 算(`(function(){
    const b=窗.内.querySelector(':scope > .blk');
    const h=b.querySelector(':scope > .head').getBoundingClientRect();
    let d=null; const id=b.dataset.id;
    (function 走(l){for(const x of l||[]){ if(String(x.id)===id) d={x:x.x,y:x.y}; 走(x.子); for(const s of x.分支||[]) 走(s.子);} })(根块们);
    return JSON.stringify({id, 头:[h.left+h.width/2, h.top+h.height/2], d, 总:(窗.内视.z||视.z)});
  })()`));
  const 命B = await 命中(B0.头);
  if (命B.块 === B0.id) {
    const 放 = [B0.头[0] + 90, B0.头[1] + 55];
    静('拖', ...屏(B0.头), ...屏(放));
    await 等(900);
    const B1 = JSON.parse(await 算(`(function(){
      const b=document.querySelector('.blk[data-id="${B0.id}"'); let d=null;
      return JSON.stringify({d:(function(){let r=null;(function 走(l){for(const x of l||[]){ if(String(x.id)==='${B0.id}') r={x:x.x,y:x.y}; 走(x.子); for(const s of x.分支||[]) 走(s.子);} })(根块们); return r;})()});
    })()`));
    const dx = B1.d.x - B0.d.x, dy = B1.d.y - B0.d.y;
    const 望x = 90 / B0.总, 望y = 55 / B0.总;
    记('内部块拖动换算正确', Math.abs(dx - 望x) < 5 && Math.abs(dy - 望y) < 5,
      `位移 (${dx.toFixed(1)},${dy.toFixed(1)}) 期望 (${望x.toFixed(1)},${望y.toFixed(1)})`);
  } else {
    记('内部块拖动换算正确', false, `抓点没落到块上，命中 ${命B.元素}`);
  }

  console.log('\n════ 7. 拖外部实例框，里面的块数据不该变 ══');
  await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    视.z=0.6; 视.x=舞台.getBoundingClientRect().left+20-parseFloat(实.style.left)*视.z;
    视.y=舞台.getBoundingClientRect().top+40-parseFloat(实.style.top)*视.z; 应用视(); return 'ok'; })()`);
  await 等(500);
  const C0 = JSON.parse(await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    const r=实.getBoundingClientRect();
    // 取框内靠上的点，别取到框外面的空白
    const b=窗.内.querySelector(':scope > .blk'); let d=null;
    (function 走(l){for(const x of l||[]){ if(String(x.id)===b.dataset.id) d={x:x.x,y:x.y}; 走(x.子); for(const s of x.分支||[]) 走(s.子);} })(根块们);
    return JSON.stringify({p:[r.left+60,r.top+18], left:parseFloat(实.style.left), d});
  })()`));
  const 命C = await 命中(C0.p);
  if (命C.实例) {
    静('拖', ...屏(C0.p), ...屏([C0.p[0] - 70, C0.p[1] + 35]));
    await 等(800);
    const C1 = JSON.parse(await 算(`(function(){
      const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
      return JSON.stringify({left:parseFloat(实.style.left), 窗还在:!!窗.el}); })()`));
    const 块后 = JSON.parse(await 算(`(function(){ const b=窗.内.querySelector(':scope > .blk'); let r=null;
      (function 走(l){for(const x of l||[]){ if(String(x.id)===b.dataset.id) r={x:x.x,y:x.y}; 走(x.子); for(const s of x.分支||[]) 走(s.子);} })(根块们); return JSON.stringify({d:r}); })()`));
    记('拖实例框 → 框动了', Math.abs(C1.left - C0.left) > 10, `${C0.left} → ${C1.left}`);
    记('拖实例框 → 块数据没被带走', Math.abs(块后.d.x - C0.d.x) < 1 && Math.abs(块后.d.y - C0.d.y) < 1, `块 (${C0.d.x.toFixed(1)},${C0.d.y.toFixed(1)})`);
    记('拖实例框 → 窗户没丢', C1.窗还在);
  } else 记('拖实例框 → 框动了', false, `抓点命中 ${命C.元素}`);

  console.log('\n════ 8. 关窗 ════');
  await 算(`(function(){ 关窗(); 重画(); return 'ok'; })()`);
  await 等(700);
  const 关后 = JSON.parse(await 算(`JSON.stringify({窗:!!窗.el, 当前画布:当前画布?'有':'null',
    世界直属块:世界.querySelectorAll(':scope > .blk').length, 实例框:document.querySelectorAll('.实例框').length})`));
  记('关窗后窗户消失', !关后.窗);
  记('关窗后块不回摊到关系网上', 关后.世界直属块 === 0, 关后.世界直属块 + ' 块摊在外面');
  记('关窗后网还在', 关后.实例框 > 0, 关后.实例框 + ' 个实例框');

  // ══ 还原 ══
  await 算(`(function(){
    const 快照 = ${JSON.stringify(快照)};
    for (const 工 of 快照) {
      if (!工程表[工.名]) continue;
      const 表 = new Map(工.块.map(o => [String(o.id), o]));
      (function 走(l){ for (const x of l||[]) { const s = 表.get(String(x.id)); if (s) { x.x = s.x; x.y = s.y; }
        走(x.子); for (const b of x.分支||[]) 走(b.子); } })(工程表[工.名].块们||[]);
    }
    存盘(); 重画(); 对准块();
    return 'ok';
  })()`);
  await 等(600);
  const 还原后 = JSON.parse(await 算(`(function(){ let 坏=0;
    for (const 名 of Object.keys(工程表)) (function 走(l){ for (const x of l||[]) { if (Math.abs(x.x)>3000||Math.abs(x.y)>3000) 坏++; 走(x.子); for (const s of x.分支||[]) 走(s.子); } })(工程表[名].块们||[]);
    return JSON.stringify({坏}); })()`));
  记('测试后数据已还原', 还原后.坏 === 0, 还原后.坏 + ' 个坐标越界');

  const 过 = 结.filter(x => x.过).length, 总 = 结.length;
  console.log(`\n════ 合计 ${过}/${总} 通过 ════`);
  结.filter(x => !x.过).forEach(x => console.log(`  ✗ ${x.名}`));
  ws.close();
})().catch(e => { console.error('❗ ' + e.message); process.exit(1); });
