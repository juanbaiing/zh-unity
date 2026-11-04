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

  console.log('\n════ 1. 起手状态 ════');
  // 复位：这一项要验「打开就是网，块不摊在外面」，得先把手动留下的窗关掉。
  // 不然上一条用例、或者我自己调试时开的窗，会让块留在 DOM 里，
  // 报到「26 块摊在外面」—— 那不是产品错，是测试没把自己擦干净。
  await 算(`(function(){ if (窗.el) 关窗(); return 'ok'; })()`);
  await 等(400);

  // ══ 快照：所有工程的块坐标，跑完还原 ══
  // ⚠️ 必须拍在「复位」之后。拍在之前的话，关窗会重画一次、块位置跟着变，
  //    结束时判定「没还原」就是假阳性 —— 其实是快照本身拍歪了。
  const 快照 = JSON.parse(await 算(`(function(){ const 出=[];
    for (const 名 of Object.keys(工程表)) { const 块=[];
      (function 走(l){ for (const x of l||[]) { 块.push({id:x.id,x:x.x,y:x.y}); 走(x.子); for (const s of x.分支||[]) 走(s.子); } })(工程表[名].块们||[]);
      出.push({名, 块}); }
    return JSON.stringify(出); })()`));
  // 实例框的位置也要拍 —— 第 7 步会拖框，不还原的话每跑一轮就往左漂一点，
  // 漂到某个布局时曲线会撞上中间的框，于是「连线不穿过不相干的框」时绿时红。
  // 那是我自己的测试在污染数据，不是产品问题。
  const 框快照 = JSON.parse(await 算(`JSON.stringify([...网.位置].map(([id,v])=>({id, x:v.x, y:v.y})))`));

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

  // 线不能穿过**不相干的**框。
  //
  // 判据为什么要排除源和目标：线现在落在「脚本行」上，而行在框内部 ——
  // 从框边进到那一行，必然穿一小段自己的框，那是它该走的路。
  // 真正要抓的是 Coin→Cube 那种：线钻进 Cube 内部走了一大段才出来。
  // ⚠️ 这条判据改过两次，每次都是被同一件事骗：判据得跟「线该落在哪」一起变。
  const 穿框 = JSON.parse(await 算(`(function(){
    const 框们=[...document.querySelectorAll('#网层 .实例框')]
      .filter(e=>!e.classList.contains('空头框') && !e.classList.contains('孤岛框'))
      .map(e=>({id:e.dataset.id, x:parseFloat(e.style.left)||0, y:parseFloat(e.style.top)||0,
                w:e.offsetWidth, h:e.offsetHeight}));
    const 查=[];
    for(const p of document.querySelectorAll('#线层 path[data-自]')){
      const d=p.getAttribute('d')||'';
      if(/^M [\\d.-]+ [\\d.-]+ l /.test(d)) continue;   // 箭头（M x y l ...）
      const 长=p.getTotalLength();
      if(!长) continue;
      const 自=String(p.dataset.自||''), 到=String(p.dataset.到||'');
      const 撞=new Set();
      for(let 沿=0; 沿<=长; 沿+=Math.max(2, 长/300)){
        const pt=p.getPointAtLength(沿);
        for(const b of 框们){
          if(b.id===自 || b.id===到) continue;
          if(pt.x>b.x+2&&pt.x<b.x+b.w-2&&pt.y>b.y+2&&pt.y<b.y+b.h-2) 撞.add(b.id);
        }
      }
      if(撞.size) 查.push(自.split('.').pop()+'→'+到.split('.').pop()+' 进了 '+[...撞].map(s=>s.split('.').pop()).join(','));
    }
    return JSON.stringify({条:查.length, 例:查[0]||''});
  })()`));
  记('连线不穿过不相干的框', 穿框.条 === 0, 穿框.条 ? `${穿框.条} 条穿框，例如 ${穿框.例}` : '全部干净');

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
    // ⚠️ 算「装不装得下」要用**相对**包围盒，不是绝对右界。
    // 开窗时会把内容包围盒的左上角搬到 (边,边)（内视.x/y 可以是负的几千），
    // 所以块的绝对 left 可以到 4700 —— 那不代表它飞出去了。
    let 左=Infinity, 右=0;
    for(const el of 窗.内.querySelectorAll(':scope > .blk')){
      const l=parseFloat(el.style.left)||0;
      左=Math.min(左,l); 右=Math.max(右,l+el.offsetWidth);
    }
    const 跨 = 右>0 ? 右 - (isFinite(左)?左:0) : 0;
    const rb=b?b.getBoundingClientRect():null;
    返回=null;
    return JSON.stringify({有窗:!!w, 内视:窗.内视.z, 窗:[r.left,r.top,r.width,r.height],
      块数:窗.内.querySelectorAll('.blk').length, 顶层块跨:Math.round(跨),
      窗CSS宽:w.offsetWidth, 可见域:w.offsetWidth/窗.内视.z,
      首块屏:rb?[Math.round(rb.left),Math.round(rb.top),Math.round(rb.width)]:null});
  })()`));
  记('窗户建出来了', W.有窗);
  记('块渲染进窗户', W.块数 > 0, W.块数 + ' 块');
  记('块在窗户可见域内（不飞）', W.顶层块跨 <= W.可见域 + 1, `块跨 ${W.顶层块跨} vs 可见域 ${Math.round(W.可见域)}`);
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
  await 算(`(function(){ 窗.内视={x:16,y:16,z:窗.内视.z}; 应用内视();
    // 重置内视只是为了让「总缩放」可预测，不代表块就落在窗户里了 ——
    // 实测块心在 (1047,780)，窗户底是 775，差 5px 就掉出去，
    // 鼠标按下去落到实例框上。所以这里把它拎回可见区中间。
    const w=窗.el.getBoundingClientRect();
    const b=窗.内.querySelector(':scope > .blk');
    if (b) {
      const r=b.querySelector(':scope > .head').getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      if (cx<w.left+40||cx>w.right-40||cy<w.top+40||cy>w.bottom-40) {
        窗.内视.x += (w.left+w.width/2) - cx;   // 内视.x 本身就是屏幕 px 量级
        窗.内视.y += (w.top+w.height/2) - cy;
        应用内视();
      }
    }
    return 'ok'; })()`);
  await 等(400);
  const B0 = JSON.parse(await 算(`(function(){
    // 挑一个「头中心落在窗户可见矩形里」的块来拖。
    // 以前是直接取第一个块 —— 但内视刚被重置成 {16,16}，第一个块可能被推出
    // 可见域，鼠标按下去落在实例框上，报「抓点没落到块上，命中 DIV.实例脚」。
    // 那不等于拖拽坏了，只等于这次没抓到块。挑可见的那个才算真测。
    // ⚠️ 判据用「中心点」不是「整个头」—— 窗户可见域高 806，块头只要有一半
    //    露出来就够鼠标按，要求整个头完全在里面会把能拖的块全判成不可见。
    const w = 窗.el.getBoundingClientRect();
    let b = null, h = null;
    for (const x of 窗.内.querySelectorAll(':scope > .blk')) {
      const r = x.querySelector(':scope > .head').getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx > w.left + 10 && cx < w.right - 10 &&
          cy > w.top + 10 && cy < w.bottom - 10) { b = x; h = r; break; }
    }
    if (!b) return JSON.stringify({无可见块: true});
    let d=null; const id=b.dataset.id;
    (function 走(l){for(const x of l||[]){ if(String(x.id)===id) d={x:x.x,y:x.y}; 走(x.子); for(const s of x.分支||[]) 走(s.子);} })(根块们);
    // 总缩放 = 内层 × 外层，两个都得算。
    // 块躺在 内世界 里，内世界又被 #world 按 视.z 缩过一遍 ——
    // 屏幕上走 90px，数据位移是 90 ÷ (内视.z × 视.z)。
    // 这里原来只除了 内视.z，漏了外层（实测 0.182 × 3.763 = 0.685），
    // 于是量到 (376.2,228.6) 而期望 (1125,687.5)，差 2.99 倍 —— 不是代码错，是这个期望值错。
    return JSON.stringify({id, 头:[h.left+h.width/2, h.top+h.height/2], d,
      总:((窗.内视.z || 1) * (视.z || 1))});
  })()`));
  const 命B = B0.无可见块 ? { 元素: '（无可见块）', 块: null } : await 命中(B0.头);
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
    记('内部块拖动换算正确', false,
      B0.无可见块 ? '窗户里一个完全可见的块都没有（内视重置把块全推出去了）'
                  : `抓点没落到块上，命中 ${命B.元素}`);
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
    const 按快照改 = (列表, 表) => {
      (function 走(l){ for (const x of l||[]) {
        const s = 表.get(String(x.id)); if (s) { x.x = s.x; x.y = s.y; }
        走(x.子); for (const b of x.分支||[]) 走(b.子); } })(列表||[]);
    };
    for (const 工 of 快照) {
      if (!工程表[工.名]) continue;
      按快照改(工程表[工.名].块们, new Map(工.块.map(o => [String(o.id), o])));
    }
    // ⚠️ 还要改 根块们。切到工程时 修环() 会重建一份，根块们 和 工程表[...].块们
    //    是**两个不同的对象**（实测改前者，后者纹丝不动）。存盘() 读的是 根块们，
    //    只改 工程表 的话等于没改 —— 块每跑一轮就累加一次拖动量。
    const 现工 = 快照.find(工 => 工.名 === 当前工程);
    if (现工) 按快照改(根块们, new Map(现工.块.map(o => [String(o.id), o])));
    存盘();
    return 'ok';
  })()`);
  await 等(400);
  // 实例框还原：连 DOM 一起摆回去，再画一次线、存一次布局
  await 算(`(function(){
    const 快照 = ${JSON.stringify(框快照)};
    for (const o of 快照) 网.位置.set(o.id, { x: o.x, y: o.y });
    for (const el of document.querySelectorAll('#网层 .实例框')) {
      const 位 = 网.位置.get(el.dataset.id);
      if (位) { el.style.left = 位.x + 'px'; el.style.top = 位.y + 'px'; }
    }
    画线(); 存布局();
    return 'ok';
  })()`);
  await 等(600);
  const 还原后 = JSON.parse(await 算(`(function(){
    // 「还原」的判据是「跟开跑前的快照一致」，不是「坐标绝对值小」。
    // 原来用 |x|>6000 判坏，可块本来就能合法地在几千的位置（开窗时视野用负偏移
    // 把内容搬进来过），于是干净的数据也被判成没还原。
    const 快照 = ${JSON.stringify(快照)};
    let 偏 = 0, 例 = '';
    for (const 工 of 快照) {
      if (!工程表[工.名]) continue;
      const 表 = new Map(工.块.map(o => [String(o.id), o]));
      (function 走(l){ for (const x of l||[]) {
        const s = 表.get(String(x.id));
        if (s && (Math.abs(x.x - s.x) > 0.5 || Math.abs(x.y - s.y) > 0.5)) {
          偏++;
          if (!例) 例 = String(x.id) + ' ('+Math.round(s.x)+','+Math.round(s.y)+') → ('+Math.round(x.x)+','+Math.round(x.y)+')';
        }
        走(x.子); for (const b of x.分支||[]) 走(b.子); } })(工程表[工.名].块们||[]);
    }
    return JSON.stringify({偏, 例}); })()`));
  记('测试后数据已还原', 还原后.偏 === 0, 还原后.偏 ? `${还原后.偏} 个块没回到原位，例如 ${还原后.例}` : '全部回到开跑前的坐标');

  const 过 = 结.filter(x => x.过).length, 总 = 结.length;
  console.log(`\n════ 合计 ${过}/${总} 通过 ════`);
  结.filter(x => !x.过).forEach(x => console.log(`  ✗ ${x.名}`));
  ws.close();
})().catch(e => { console.error('❗ ' + e.message); process.exit(1); });
