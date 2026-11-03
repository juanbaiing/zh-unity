// 连上编辑器的 WebView2，执行 JS，把结果打出来。
// 用法: node _连.js "根块们.length" "舞台视" "..."
const http = require('http');

const 端口 = process.env.ZH_PORT || 9222;

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

  for (const 表达式 of process.argv.slice(2)) {
    try {
      const r = await 调用('Runtime.evaluate', {
        expression: 表达式,
        returnByValue: true,
        awaitPromise: false,
      });
      const v = r.result;
      let 出;
      if (v.type === 'undefined') 出 = 'undefined';
      else 出 = JSON.stringify(v.value);
      console.log(表达式 + '  →  ' + 出);
    } catch (e) {
      console.log(表达式 + '  →  出错: ' + e.message);
    }
  }
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
