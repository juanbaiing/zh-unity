// 把某个实例框居中放大，再截图 —— 看细节用
const http = require('http');
const fs = require('fs');

const 端口 = process.env.ZH_PORT || 9222;
const 目标 = process.argv[2] || 'Cube';
const 出 = process.argv[3] || 'D:/dswork/_截图/近看.png';
const 倍数 = parseFloat(process.argv[4] || '2.6');

function 要(路径) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${路径}`, r => {
      let b = '';
      r.on('data', c => (b += c));
      r.on('end', () => 好(b));
    }).on('error', 坏);
  });
}

(async () => {
  const 列表 = JSON.parse(await 要('/json/list'));
  const 页 = 列表.find(t => t.type === 'page');
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 等 = new Map();
  let 号 = 0;
  const 调用 = (method, params = {}) => new Promise((好, 坏) => {
    const id = ++号;
    等.set(id, { 好, 坏 });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && 等.has(m.id)) {
      const { 好, 坏 } = 等.get(m.id);
      等.delete(m.id);
      m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result);
    }
  };
  await new Promise(好 => (ws.onopen = 好));
  await 调用('Page.enable');

  // 先让页面把目标框居中放大。
  // 设两次：页面里 适配舞台 挂在 requestAnimationFrame 上，可能在我们之后才跑，
  // 会把视野拉回去 —— 所以等一轮再设一次。
  const 造表达式 = () => `(function(){
    const el = [...世界.querySelectorAll('.物框')].find(e => e.dataset.id.includes(${JSON.stringify(目标)}));
    if (!el) return '没找到 ' + ${JSON.stringify(目标)};
    舞台视.z = ${倍数};
    const sr = 舞台.getBoundingClientRect();
    舞台视.x = sr.width / 2 - (parseFloat(el.style.left) + el.offsetWidth / 2) * 舞台视.z;
    舞台视.y = sr.height / 2 - (parseFloat(el.style.top) + el.offsetHeight / 2) * 舞台视.z;
    应用舞台视();
    return el.querySelectorAll('.窗块').length + ' 个窗块, z=' + 舞台视.z;
  })()`;

  let r = await 调用('Runtime.evaluate', { expression: 造表达式(), returnByValue: true });
  console.log(目标 + ' → ' + JSON.stringify(r.result.value));
  await new Promise(好 => setTimeout(好, 500));
  r = await 调用('Runtime.evaluate', { expression: 造表达式(), returnByValue: true });
  console.log(目标 + ' 再设 → ' + JSON.stringify(r.result.value));

  await new Promise(好 => setTimeout(好, 700));

  const 图 = await 调用('Page.captureScreenshot', { format: 'png' });
  const 目录 = require('path').dirname(出);
  if (!fs.existsSync(目录)) fs.mkdirSync(目录, { recursive: true });
  fs.writeFileSync(出, Buffer.from(图.data, 'base64'));
  console.log(出 + '  ' + fs.statSync(出).size + ' 字节');
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
