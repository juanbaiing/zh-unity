// 真鼠标滚轮缩窗户：验证 ① 窗户内缩放变了 ② 外层 视.z 一点没动
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

  // 开窗
  await 算(`(function(){
    const 实=document.querySelector('.实例框[data-id="场景|SampleScene.Cube"]');
    if (窗.el) 关窗();
    视.z=2;
    // ⚠️ 视.x 是「世界坐标 → 屏幕」的平移量，要按 视.z 折算，直接减 left 会跑到视野外
    视.x=舞台.getBoundingClientRect().left+40-parseFloat(实.style.left)*视.z;
    视.y=舞台.getBoundingClientRect().top+40-parseFloat(实.style.top)*视.z;
    应用视();
    开窗(实,'PlayerAttack'); 装窗缩放();
    return 'ok';
  })()`);
  await 等(1200);

  const 前 = JSON.parse(await 算(`(function(){
    const r=窗.el.getBoundingClientRect();
    return JSON.stringify({外层:视.z, 内层:窗.内视.z, 窗:[r.left,r.top,r.width,r.height], 绑了:!!窗.el._绑了});
  })()`));
  console.log(`开窗后：外层 ${前.外层}  内层 ${前.内层.toFixed(3)}  窗户屏幕(${Math.round(前.窗[0])},${Math.round(前.窗[1])}) ${Math.round(前.窗[2])}×${Math.round(前.窗[3])}  滚轮绑上 ${前.绑了}`);

  const 心 = [前.窗[0] + 前.窗[2] / 2, 前.窗[1] + 前.窗[3] / 2];
  // 往上滚 = 放大窗户里
  try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, '滚', ...屏(心).map(String), '3'], { stdio: 'ignore' }); } catch (e) { console.log('⚠ 滚轮失败'); }
  await 等(600);

  const 后 = JSON.parse(await 算('JSON.stringify({外层:视.z, 内层:窗.内视.z})'));
  console.log(`滚 3 格后：外层 ${后.外层}  内层 ${后.内层.toFixed(3)}`);
  console.log(`  窗户内放大 ${(后.内层 / 前.内层).toFixed(2)} 倍 ${后.内层 > 前.内层 ? '✓' : '✗'}`);
  console.log(`  外层没被带着动 ${后.外层 === 前.外层 ? '✓' : '✗ 外层从 ' + 前.外层 + ' 变成了 ' + 后.外层}`);

  // 再验一次块拖拽的换算：拖一个块，看数据位移 = 屏幕位移 / (外层×内层)
  const 块 = JSON.parse(await 算(`(function(){
    const b=窗.内.querySelector(':scope > .blk');
    const h=b.querySelector(':scope > .head'); const r=h.getBoundingClientRect();
    return JSON.stringify({id:b.dataset.id, 头:[r.left+r.width/2, r.top+r.height/2], x:parseFloat(b.style.left), y:parseFloat(b.style.top)});
  })()`));
  const 命 = JSON.parse(await 算(`(function(){const e=document.elementFromPoint(${块.头[0]},${块.头[1]});
    const b=e&&e.closest('.blk'); return JSON.stringify({元素:e?e.tagName+'.'+(e.className||''):'null', 块:b?b.dataset.id:null});})()`));
  console.log(`\n拖块 id=${块.id}：抓 (${块.头[0].toFixed(0)},${块.头[1].toFixed(0)}) 命中 ${命.元素} 属于 ${命.块}`);
  if (命.块 === 块.id) {
    const 放 = [块.头[0] + 120, 块.头[1] + 60];
    try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, '拖', ...屏(块.头).map(String), ...屏(放).map(String)], { stdio: 'ignore' }); } catch (e) {}
    await 等(900);
    const 末 = JSON.parse(await 算(`(function(){
      const b=document.querySelector('.blk[data-id="${块.id}"]');
      let 数据=null; (function 找(l){for(const x of l||[]){ if(Number(x.id)===${块.id}) 数据={x:x.x,y:x.y}; 找(x.子); for(const s of x.分支||[]) 找(s.子);} })(根块们);
      return JSON.stringify({style:[parseFloat(b.style.left),parseFloat(b.style.top)], 数据});
    })()`));
    const 缩放 = 后.外层 * 后.内层;
    const dx = (末.数据.x - 块.x), dy = (末.数据.y - 块.y);
    console.log(`  屏幕位移 (120,60) ÷ 总缩放(${缩放.toFixed(2)}) = 期望 (${(120/缩放).toFixed(1)}, ${(60/缩放).toFixed(1)})`);
    console.log(`  数据位移 (${dx.toFixed(1)}, ${dy.toFixed(1)})  ${Math.abs(dx-120/缩放)<4&&Math.abs(dy-60/缩放)<4?'✓':'✗'}`);
  }
  ws.close();
})().catch(e => { console.error('❗ ' + e.message); process.exit(1); });
