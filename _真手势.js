// 真鼠标手势：滚轮缩放 + 拖空白平移 + 点击输入框
// 全程只走 Windows 输入管线。
//
// 页面布局（实测）：调色板 (7,104)141×1378 | 画布 stage (170,78)699×766 | 输出 out(x904) 出错 errs(x904,y591)
// ⇒ 画布的 client 有效区只有 x 170..869，y 78..844。之前把点打在 1250 上，
//   砸的是右侧面板，属于我的测试选点错，不是编辑器错。
const http = require('http');
const { execFileSync } = require('child_process');

const 端口 = 9222;
const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';
const 截 = 'D:\\dswork\\zh-csharp-lab\\_截页.js';
const 等 = ms => new Promise(r => setTimeout(r, ms));
const 静 = (动作, ...数) => {
  try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, 动作, ...数.map(String)], { stdio: 'ignore' }); }
  catch (e) { console.log(`  ⚠ ${动作} 失败`); }
};

function 要(p) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${p}`, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => 好(b)); }).on('error', 坏);
  });
}

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
    if (r.exceptionDetails) return '❗' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  const 原 = JSON.parse(await 算('JSON.stringify({x:window.screenX,y:window.screenY})'));
  const 屏 = ([x, y]) => [Math.round(x + 原.x), Math.round(y + 原.y)];
  const 视 = async () => JSON.parse(await 算('JSON.stringify(视)'));
  const 报 = async 标 => { const v = await 视(); console.log(`  ${标}: x=${v.x.toFixed(1)} y=${v.y.toFixed(1)} z=${v.z.toFixed(3)}`); return v; };
  const 复位 = async (v) => 算(`视.x=${v.x};视.y=${v.y};视.z=${v.z};应用视();'ok'`);   // 视 是 const，只能改字段

  const 起 = await 报('初始');

  // ---------- 1. 真滚轮放大 ----------
  const 中 = [500, 400];
  console.log(`\n=== 滚轮：client(${中[0]},${中[1]}) 向上 3 格 ===`);
  静('滚', ...屏(中), 3); await 等(400);
  const 大 = await 报('后');
  console.log(`  ${大.z > 起.z ? '✓' : '✗'} 放大  ${起.z.toFixed(3)} → ${大.z.toFixed(3)}`);

  // ---------- 2. 真滚轮缩小（之前失败的那条）----------
  console.log(`\n=== 滚轮：同一处向下 3 格 ===`);
  静('滚', ...屏(中), -3); await 等(400);
  const 小 = await 报('后');
  console.log(`  ${小.z < 大.z ? '✓' : '✗'} 缩小  ${大.z.toFixed(3)} → ${小.z.toFixed(3)}`);

  // ---------- 3. 真拖空白平移 ----------
  await 复位(起); await 等(200);
  // 缩到 0.35，块挤在左上，右下会空出来
  await 算('视.z=0.35;应用视();"ok"'); await 等(300);
  let 空 = null;
  for (const [x, y] of [[800, 780], [820, 600], [830, 300], [760, 800], [500, 820]]) {
    const t = await 算(`(function(){const e=document.elementFromPoint(${x},${y});return e?(e.id||e.className||e.tagName):'null';})()`);
    if (t === 'world' || t === 'stage') { 空 = [x, y]; console.log(`\n=== 拖空白：client(${x},${y}) 是「${t}」 ===`); break; }
  }
  if (!空) console.log('\n=== 拖空白：没找到空白点，跳过 ===');
  else {
    const 前 = await 视();
    静('拖', ...屏(空), ...屏([空[0] - 100, 空[1] - 60])); await 等(500);
    const 后 = await 视();
    const dx = 后.x - 前.x, dy = 后.y - 前.y;
    console.log(`  视位移 (${dx.toFixed(1)}, ${dy.toFixed(1)})  期望 (-100, -60)  ${Math.abs(dx + 100) < 3 && Math.abs(dy + 60) < 3 ? '✓' : '✗'}`);
  }

  // ---------- 4. 真点输入框 ----------
  await 复位(起); await 等(300);
  const 框 = await 算(`(function(){
    const b=世界.querySelector('.blk'); if(!b) return 'null';
    const i=b.querySelector('input'); if(!i) return 'null';
    const r=i.getBoundingClientRect();
    return JSON.stringify({x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height, v:i.value, dis:i.disabled, ro:i.readOnly});
  })()`);
  console.log(`\n=== 点输入框 ===`);
  if (框 === 'null') console.log('  没找到 input');
  else {
    const f = JSON.parse(框);
    console.log(`  矩形中心 client(${f.x.toFixed(0)},${f.y.toFixed(0)}) ${f.w.toFixed(0)}×${f.h.toFixed(0)}  value="${f.v}"`);
    const 命 = await 算(`(function(){const e=document.elementFromPoint(${f.x},${f.y});return e?(e.tagName+'.'+(e.className||'')):'null';})()`);
    console.log(`  该点命中：${命}`);
    const 前 = await 算('document.activeElement.tagName+"/"+(document.activeElement.className||"")');
    静('点', ...屏([f.x, f.y])); await 等(400);
    const 后 = await 算('document.activeElement.tagName+"/"+(document.activeElement.className||"")');
    console.log(`  焦点 ${前} → ${后}   ${后.startsWith('INPUT') ? '✓ 进得去' : '✗ 没进去'}`);
  }

  // ---------- 复位 ----------
  await 复位(起);
  await 报('\n复位');
  try { execFileSync('node', [截, 'D:\\dswork\\_截图\\真手势-复位后.png'], { stdio: 'ignore' }); console.log('截图 → D:\\dswork\\_截图\\真手势-复位后.png'); } catch (e) { }
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
