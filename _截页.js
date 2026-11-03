// 用 CDP 让 WebView2 自己截图（Page.captureScreenshot）。
// 比 CopyFromScreen 可靠：不受窗口遮挡、不受 GPU 合成影响。
const http = require('http');
const fs = require('fs');

const 端口 = process.env.ZH_PORT || 9222;
const 出 = process.argv[2] || 'D:/dswork/_截图/页面.png';

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
  const 页 = 列表.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!页) { console.error('没有可连的页面'); process.exit(1); }

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
      if (m.error) 坏(new Error(JSON.stringify(m.error)));
      else 好(m.result);
    }
  };

  await new Promise(好 => (ws.onopen = 好));
  await 调用('Page.enable');

  const r = await 调用('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const 目录 = require('path').dirname(出);
  if (!fs.existsSync(目录)) fs.mkdirSync(目录, { recursive: true });
  fs.writeFileSync(出, Buffer.from(r.data, 'base64'));

  console.log(出 + '  ' + fs.statSync(出).size + ' 字节');
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
