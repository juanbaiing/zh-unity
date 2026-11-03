// 精确测：只盯同一个块（按 id），拖前拖后量它的布局宽和屏幕宽。
// 上次用 querySelector 选，拖完结构变了会选到别的块，读数不可信。
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

  await 调用('Runtime.evaluate', {
    expression: `window.__精确测 = function(取块, dx, dy){
      const 块 = 取块();
      if (!块) return {错:'没拿到块'};
      const id = Number(块.dataset.id);
      const 找 = (列) => { for (const b of (列||[])) { if (b.id===id) return b; const r=找(b.子); if(r)return r; for(const f of (b.分支||[])){const q=找(f.子); if(q)return q;} } return null; };
      const b = 找(根块们);
      const 前 = { x:+b.x.toFixed(1), y:+b.y.toFixed(1), 布局宽:块.offsetWidth, 屏宽:Math.round(块.getBoundingClientRect().width) };
      const r = 块.getBoundingClientRect();
      const 抓x = 8, 抓y = 8;
      const 发 = (t,x,y,目) => 目.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,button:0,pointerId:1}));
      发('pointerdown', r.left+抓x, r.top+抓y, 块);
      发('pointermove', r.left+抓x+dx*0.3, r.top+抓y+dy*0.3, document);
      发('pointermove', r.left+抓x+dx, r.top+抓y+dy, document);
      const 拖中 = document.querySelector('.blk.dragging');
      const 拖中宽 = 拖中 ? Math.round(拖中.getBoundingClientRect().width) : null;
      发('pointerup', r.left+抓x+dx, r.top+抓y+dy, document);
      // 拖完按 id 重新找元素，不靠选择器
      const 后块 = 世界.querySelector('.blk[data-id="'+id+'"]');
      const b2 = 找(根块们);
      return {
        id, z:+视.z.toFixed(2),
        拖前: 前,
        拖中屏宽: 拖中宽,
        拖后: 后块 ? { 布局宽:后块.offsetWidth, 屏宽:Math.round(后块.getBoundingClientRect().width), x:+b2.x.toFixed(1), y:+b2.y.toFixed(1) } : '找不到',
        父容器: 后块 && 后块.parentElement ? 后块.parentElement.className : '?'
      };
    }`,
    returnByValue: true,
  });

  const 跑 = async (名, 式) => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true });
    console.log('\n' + 名);
    console.log(JSON.stringify(r.result.value, null, 1));
  };

  // 每次都先复位，避免上一次拖动的残留影响
  await 跑('1) 顶层大块（类），z=1，拖 60,40',
    `(重画(), 视.z=1, 应用视(), window.__精确测(()=>世界.querySelector('.blk'), 60, 40))`);
  await 跑('2) 顶层大块（类），z=0.6，拖 60,40',
    `(重画(), 视.z=0.6, 应用视(), window.__精确测(()=>世界.querySelector('.blk'), 60, 40))`);
  await 跑('3) 容器内小块，z=0.6，拖 60,40',
    `(重画(), 视.z=0.6, 应用视(), window.__精确测(()=>世界.querySelector('.blk .blk'), 60, 40))`);

  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
