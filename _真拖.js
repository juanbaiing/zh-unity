// 真鼠标拖动测试：模仿人手上的动作，不用 dispatchEvent。
//
// 坐标换算（已实测标定，不是推的）：
//   页面 clientX/clientY  ↔  SetCursorPos 参数  是 1:1，
//   只差窗口客户区原点 (window.screenX, window.screenY)。DPR 不参与。
//   标定见 _标定鼠标.js：物理(200,200)→CSS(200,177)，k=1.0000，原点=(0,23)。
const http = require('http');
const { execFileSync } = require('child_process');

const 端口 = 9222;
const 鼠 = 'D:\\dswork\\zh-csharp-lab\\_鼠标.ps1';
const 截图 = 'D:\\dswork\\zh-csharp-lab\\_截页.js';
const 等 = ms => new Promise(r => setTimeout(r, ms));

function 要(p) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${p}`, r => { let b = ''; r.on('data', c => (b += c)); r.on('end', () => 好(b)); }).on('error', 坏);
  });
}

(async () => {
  const 列表 = JSON.parse(await 要('/json/list'));
  const 页 = 列表.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 待 = new Map(); let 号 = 0;
  const 调用 = (method, params = {}) => new Promise((好, 坏) => {
    const id = ++号; 待.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 待.has(m.id)) { const { 好, 坏 } = 待.get(m.id); 待.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  const 算 = async (式) => (await 调用('Runtime.evaluate', { expression: 式, returnByValue: true })).result.value;

  // 客户区原点（页面 clientX/clientY 与屏幕的偏差）
  const 原 = JSON.parse(await 算('JSON.stringify({x:window.screenX,y:window.screenY,w:innerWidth,h:innerHeight})'));
  console.log(`窗口客户区原点 = (${原.x}, ${原.y})，可视区 ${原.w}×${原.h}`);
  const 屏 = ([x, y]) => [Math.round(x + 原.x), Math.round(y + 原.y)];
  const 鼠做 = (动作, ...数) => {
    try { execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 鼠, 动作, ...数.map(String)], { stdio: 'ignore' }); }
    catch (e) { console.log(`  ⚠ 鼠标动作失败: ${动作} ${数.join(',')}`); }
  };

  // 取一个块头的屏幕矩形（client 坐标，不看 transform）
  const 取块 = async () => JSON.parse(await 算(`(function(){
    const e = 世界.querySelector('.blk');
    if (!e) return 'null';
    const r = e.getBoundingClientRect();
    return JSON.stringify({id:e.dataset.id, x:r.left, y:r.top, w:r.width, h:r.height, tx:getComputedStyle(e).transform, l:parseFloat(e.style.left)||0, t:parseFloat(e.style.top)||0});
  })()`));

  const 前 = await 取块();
  if (!前) { console.log('画布上没有块'); ws.close(); return; }
  console.log(`\n块的矩形：client(${前.x.toFixed(0)},${前.y.toFixed(0)}) ${前.w.toFixed(0)}×${前.h.toFixed(0)}  style.left=${前.l} top=${前.t}`);

  // 抓块头左侧空白处（避开输入框/按钮）
  const 抓 = [前.x + 16, 前.y + 9];
  const 移 = [150, 120];
  const 放 = [抓[0] + 移[0], 抓[1] + 移[1]];

  console.log(`真鼠标拖：client(${抓[0].toFixed(0)},${抓[1].toFixed(0)}) → (${放[0].toFixed(0)},${放[1].toFixed(0)})  位移 (${移[0]},${移[1]})`);
  const a = 屏(抓), b = 屏(放);
  console.log(`  实际屏幕坐标 (${a[0]},${a[1]}) → (${b[0]},${b[1]})`);
  鼠做('拖', a[0], a[1], b[0], b[1]);
  await 等(600);

  const 后 = await 取块();
  console.log(`\n拖后：client(${后.x.toFixed(0)},${后.y.toFixed(0)})  style.left=${后.l} top=${后.t}`);
  console.log(`  屏幕位移 = (${(后.x - 前.x).toFixed(0)}, ${(后.y - 前.y).toFixed(0)})   期望 (${移[0]}, ${移[1]})`);
  console.log(`  数据位移 = (${(后.l - 前.l).toFixed(1)}, ${(后.t - 前.t).toFixed(1)})`);
  const 视 = JSON.parse(await 算('JSON.stringify(视)'));
  console.log(`  缩放 z=${视.z.toFixed(3)}  ⇒ 屏幕位移 / z = (${((后.x - 前.x) / 视.z).toFixed(1)}, ${((后.y - 前.y) / 视.z).toFixed(1)})`);

  try { execFileSync('node', [截图, 'D:\\dswork\\_截图\\真鼠标-拖后.png'], { stdio: 'ignore' }); console.log('\n截图 → D:\\dswork\\_截图\\真鼠标-拖后.png'); } catch (e) { }
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
