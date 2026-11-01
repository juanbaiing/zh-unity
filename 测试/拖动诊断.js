// 用浏览器真实输入管道拖一次，并在每一步记录所有块的位置 —— 看谁在乱跑
const http = require('http');
const 睡 = ms => new Promise(r => setTimeout(r, ms));
const 连 = () => new Promise((res, rej) => {
  http.get('http://127.0.0.1:9223/json/list', r => {
    let s = ''; r.on('data', c => s += c);
    r.on('end', () => { try { const p = JSON.parse(s).find(x => x.type === 'page' && x.url.includes('zh.editor')); p ? res(p.webSocketDebuggerUrl) : rej(new Error('无')); } catch (e) { rej(e); } });
  }).on('error', rej);
});

(async () => {
  let ws;
  for (let i = 0; i < 20; i++) { try { ws = new WebSocket(await 连()); break; } catch { await 睡(500); } }
  let id = 0; const 等 = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && 等.has(m.id)) { 等.get(m.id)(m); 等.delete(m.id); } };
  await new Promise(r => ws.onopen = r);
  const 发 = (method, params = {}) => new Promise(r => { const i = ++id; 等.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const 求值 = async x => { const r = await 发('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  const 鼠 = (type, x, y, extra = {}) => 发('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });

  // 把视口撑大，真实窗口太小（787x478），测不出东西
  await 发('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
  await 睡(1200);
  console.log('视口 =', await 求值("innerWidth + ' x ' + innerHeight"));

  // 清空 + 摆一个三层结构
  await 求值(`localStorage.clear(); 'ok'`);
  await 求值(`(() => {
    document.getElementById('clearBtn').click();
    const 类 = 建('类', 40, 40); 类.字段.名 = '敌人';
    const 法 = 建('方法', 20, 20); 法.字段.名 = '更新时';
    const 印 = 建('打印', 20, 20); 印.字段.值 = '"里面"';
    法.子.push(印); 类.子.push(法);
    const 另一个 = 建('打印', 700, 60); 另一个.字段.值 = '"旁边"';
    根块们 = [类, 另一个]; 重画();
    return 'ok';
  })()`);
  await 睡(900);

  const 记 = async (标签) => {
    const s = await 求值("(() => { const 平 = (l, 父) => l.map(b => ({ 类: b.类型, 号: b.id, 父: 父||'顶层', x: Math.round(b.x||0), y: Math.round(b.y||0), 屏x: Math.round((document.querySelector('.blk[data-id=\"'+b.id+'\"]')||{getBoundingClientRect:()=>({left:-999})}).getBoundingClientRect().left), 屏y: Math.round((document.querySelector('.blk[data-id=\"'+b.id+'\"]')||{getBoundingClientRect:()=>({top:-999})}).getBoundingClientRect().top) })).concat(...l.map(b => 平(b.子||[], b.类型)), ...l.map(b => (b.分支||[]).flatMap(s => 平(s.子||[], b.类型)))); return JSON.stringify(平(根块们, null)); })()");
    console.log('  ' + 标签.padEnd(10) + JSON.parse(s).map(n => n.类 + '#' + n.号 + '(' + n.父 + ')@' + n.x + ',' + n.y).join('  '));
    return JSON.parse(s);
  };

  console.log('\n起点：');
  const 前 = await 记('拖动前');

  // 找 chip 和目标点
  const 点 = JSON.parse(await 求值(`(() => {
    const 滚 = document.querySelector('.palette'); 滚.scrollTop = 0;
    const c = [...document.querySelectorAll('.chip')].find(x => x.textContent.startsWith('重复'));
    const r = c.getBoundingClientRect();
    const 盒 = document.querySelector('.blk[data-t="方法"] .body').getBoundingClientRect();
    return JSON.stringify({ 起x: Math.round(r.left + 18), 起y: Math.round(r.top + r.height/2), 到x: Math.round(盒.left + 40), 到y: Math.round(盒.top + 30) });
  })()`));
  console.log('\n鼠标：(' + 点.起x + ',' + 点.起y + ') → (' + 点.到x + ',' + 点.到y + ')');

  await 鼠('mouseMoved', 点.起x, 点.起y, { buttons: 0 });
  await 睡(100);
  await 鼠('mousePressed', 点.起x, 点.起y);

  console.log('\n拖动过程：');
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    await 鼠('mouseMoved', Math.round(点.起x + (点.到x - 点.起x) * t), Math.round(点.起y + (点.到y - 点.起y) * t));
    await 睡(90);
    if (i === 3 || i === 6 || i === 9) await 记('第 ' + i + ' 步');
  }

  await 鼠('mouseReleased', 点.到x, 点.到y);
  await 睡(800);

  console.log('\n松手后：');
  const 后 = await 记('松手后');

  console.log('\n=== 对比（只看原有块） ===');
  for (const a of 前) {
    const b = 后.find(x => x.号 === a.号);
    if (!b) { console.log('  ✗ 没了：' + a.类 + '#' + a.号); continue; }
    const 差 = [];
    if (a.父 !== b.父) 差.push('父 ' + a.父 + ' → ' + b.父);
    if (a.x !== b.x || a.y !== b.y) 差.push('坐标 (' + a.x + ',' + a.y + ') → (' + b.x + ',' + b.y + ')');
    console.log(差.length ? '  ✗ ' + a.类 + '#' + a.号 + '  ' + 差.join('  ') : '  ✓ ' + a.类 + '#' + a.号 + ' 没动');
  }
  console.log('\n=== 新进来的 ===');
  for (const b of 后) if (!前.find(x => x.号 === b.号)) console.log('  + ' + b.类 + '#' + b.号 + ' 父=' + b.父 + ' @' + b.x + ',' + b.y);

  await 发('Emulation.clearDeviceMetricsOverride');
  ws.close(); process.exit(0);
})().catch(e => { console.error('失败：', e.message); process.exit(1); });
