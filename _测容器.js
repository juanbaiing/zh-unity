// 容器块的内容区，在三种缩放下宽高应该完全一样。
// 不一样就说明 布局() 量到了缩放后的尺寸 —— 那容器右边界就会装不下子块。
const http = require('http');
const 端口 = process.env.ZH_PORT || 9222;

function 要(路径) {
  return new Promise((好, 坏) => {
    http.get(`http://127.0.0.1:${端口}${路径}`, r => {
      let b = ''; r.on('data', c => (b += c)); r.on('end', () => 好(b));
    }).on('error', 坏);
  });
}

(async () => {
  const 列 = JSON.parse(await 要('/json/list'));
  const 页 = 列.find(t => t.type === 'page');
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 等 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => {
    const id = ++号; 等.set(id, { 好, 坏 });
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && 等.has(m.id)) {
      const { 好, 坏 } = 等.get(m.id); 等.delete(m.id);
      m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result);
    }
  };
  await new Promise(好 => (ws.onopen = 好));

  const 跑 = async (名, 式) => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true });
    console.log(名 + ': ' + JSON.stringify(r.result.value));
  };

  await 调用('Runtime.evaluate', {
    expression: `window.__量体 = function(){
      const 类块 = [...世界.querySelectorAll('.blk')].find(e => e.querySelector(':scope > .body'));
      if (!类块) return {错:'没有容器块'};
      const 体 = 类块.querySelector(':scope > .body');
      const 子们 = [...体.children].filter(c => c.classList && c.classList.contains('blk'));
      const 子最右 = 子们.length ? Math.max(...子们.map(e => (parseFloat(e.style.left)||0) + e.offsetWidth)) : 0;
      const 子最下 = 子们.length ? Math.max(...子们.map(e => (parseFloat(e.style.top)||0) + e.offsetHeight)) : 0;
      return {
        类块宽: 类块.offsetWidth, 类块高: 类块.offsetHeight,
        内容区宽: 体.offsetWidth, 内容区高: 体.offsetHeight,
        子最右: Math.round(子最右), 子最下: Math.round(子最下),
        横向装得下: 体.offsetWidth >= 子最右,
        纵向装得下: 体.offsetHeight >= 子最下
      };
    };`,
    returnByValue: true,
  });

  for (const z of [1, 0.6, 0.3]) {
    await 跑('z=' + z, `(视.z = ${z}, 应用视(), 重画(), __量体())`);
    await new Promise(好 => setTimeout(好, 200));
    await 跑('z=' + z + ' 稳定后', `__量体()`);
  }

  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
