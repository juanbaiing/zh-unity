// 打开某张关系图/设计稿，读它的渲染状态，不改任何东西。
// 要回答的问题：现在是第几档、缩放多少、每个脚本框显示了哪些行。
// 用法: node _看关系图.js 文件路径 [navigate|不navigate]
const http = require('http');
function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
  const [文件, 导航] = process.argv.slice(2);
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

  if (导航 !== '不导航') {
    await 调用('Page.enable');
    await 调用('Page.navigate', { url: 'file:///' + 文件.replace(/\\/g, '/') });
    await new Promise(r => setTimeout(r, 2200));
  }

  const 报 = JSON.parse(await 算(`JSON.stringify((function(){
    const 出 = { 标题: document.title, 视: null, 档: null, 屏字号: null, 实例: [] };
    try { 出.视 = { x: +视.x.toFixed(1), y: +视.y.toFixed(1), w: +视.w.toFixed(1) }; } catch(e) {}
    try { 出.档 = 算档(); } catch(e) { 出.档 = '算档() 不在'; }
    try { 出.屏字号 = +屏幕字号().toFixed(1); } catch(e) {}
    try {
      for (const 实 of 场景.实例们) {
        const s = { 名: 实.名, w: 实.w, h: 实.h, 脚本: [] };
        for (const sc of 实.脚本) {
          s.脚本.push({
            名: sc.名,
            高: sc.高 && +sc.高.toFixed(0),
            槽: (sc.槽||[]).length,
            块树: (sc.块树||[]).length,
            入口: (sc.入口||[]).length,
            出口: (sc.出口||[]).length,
            收: !!sc.收,
          });
        }
        s._窗 = 实.脚本.some(x => x._窗);
        出.实例.push(s);
      }
    } catch(e) { 出.实例出错 = e.message; }
    // SVG 里到底画了多少个 text —— 这是「看得见多少信息」的直接度量
    出.text数 = document.querySelectorAll('svg text').length;
    出.foreignObject数 = document.querySelectorAll('foreignObject').length;
    return 出;
  })())`));

  console.log(`${报.标题}`);
  console.log(`视 w=${报.视 ? 报.视.w : '?'}  档=${报.档}  屏幕字号=${报.屏字号}px`);
  console.log(`SVG text ${报.text数} 个，foreignObject ${报.foreignObject数} 个`);
  console.log('');
  for (const 实 of 报.实例) {
    console.log(`▲ ${实.名}  ${实.w}×${实.h.toFixed ? 实.h.toFixed(0) : 实.h}`);
    for (const s of 实.脚本) {
      console.log(`   ${s.名.padEnd(16)} 高${String(s.高).padStart(4)}  槽${s.槽} 块树${s.块树} 入口${s.入口} 出口${s.出口}${s.收 ? ' 【收起】' : ''}`);
    }
  }
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
