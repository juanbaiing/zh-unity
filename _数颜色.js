// 统计一张截图的颜色分布 —— 用页面自己的 canvas 数，不用在 node 里写 PNG 解码器。
// 用途：验证「配色克制」这件事。判据是像素占比，不是我看图的感觉：
//   旧配色里 #7ee787（荧光绿）和 #a855f7（Tailwind 紫）都该占掉可观面积；
//   改回原设计后它们应该几乎为 0，画面被灰阶主导，绿只出现在数据值上。
//
// 用法: node _数颜色.js 图片路径
const http = require('http');
const fs = require('fs');

function 要(p) { return new Promise((好, 坏) => { http.get(`http://127.0.0.1:9222${p}`, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => 好(b)); }).on('error', 坏); }); }

(async () => {
  const 图 = fs.readFileSync(process.argv[2]).toString('base64');
  const 列 = JSON.parse(await 要('/json/list'));
  const 页 = 列.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(页.webSocketDebuggerUrl);
  const 待 = new Map(); let 号 = 0;
  const 调用 = (m, p = {}) => new Promise((好, 坏) => { const id = ++号; 待.set(id, { 好, 坏 }); ws.send(JSON.stringify({ id, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 待.has(m.id)) { const { 好, 坏 } = 待.get(m.id); 待.delete(m.id); m.error ? 坏(new Error(JSON.stringify(m.error))) : 好(m.result); } };
  await new Promise(好 => (ws.onopen = 好));
  const 算 = async 式 => {
    const r = await 调用('Runtime.evaluate', { expression: 式, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('❗' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };

  const 结果 = await 算(`(async () => {
    const 图 = new Image();
    await new Promise((好, 坏) => { 图.onload = 好; 图.onerror = 坏; 图.src = 'data:image/png;base64,${图}'; });
    const c = document.createElement('canvas');
    c.width = 图.width; c.height = 图.height;
    const g = c.getContext('2d');
    g.drawImage(图, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const 计 = new Map();
    for (let i = 0; i < d.length; i += 4) {
      // 量化到 8 级，否则抗锯齿会产生上万个近似色
      const r = d[i] >> 3, gg = d[i+1] >> 3, b = d[i+2] >> 3;
      const k = (r << 10) | (gg << 5) | b;
      计.set(k, (计.get(k) || 0) + 1);
    }
    const 总 = d.length / 4;
    const 列 = [...计.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    const 色 = k => {
      const r = ((k >> 10) & 31) << 3, g2 = ((k >> 5) & 31) << 3, b2 = (k & 31) << 3;
      return '#' + [r, g2, b2].map(v => v.toString(16).padStart(2, '0')).join('');
    };
    // 归类：饱和度高的算「有颜色」，其余算灰阶
    const 归 = { 灰:'', 绿:0, 紫:0, 蓝:0, 黄:0, 红:0, 其它彩:0 };
    for (const [k, n] of 计) {
      const r = ((k >> 10) & 31) << 3, g2 = ((k >> 5) & 31) << 3, b2 = (k & 31) << 3;
      const mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2);
      const 饱和 = mx === 0 ? 0 : (mx - mn) / mx;
      if (饱和 < 0.18) { 归.灰 += n; continue; }
      if (g2 >= r && g2 >= b2) 归.绿 += n;
      else if (b2 >= r && b2 >= g2) 归.蓝 += n;      // 紫的 b 也最高，下面再细分
      else if (r >= g2 && g2 >= b2) 归.黄 += n;
      else 归.红 += n;
      if (b2 > g2 && r > g2) 归.紫 += n;              // 紫：红蓝都高过绿
    }
    return JSON.stringify({
      尺寸: 图.width + '×' + 图.height,
      总像素: 总,
      主色: 列.map(([k, n]) => 色(k) + ' ' + (n / 总 * 100).toFixed(2) + '%'),
      归类: Object.fromEntries(Object.entries(归).map(([k, v]) => [k, typeof v === 'number' ? (v / 总 * 100).toFixed(2) + '%' : v])),
    });
  })()`);

  const o = JSON.parse(结果);
  console.log(`尺寸 ${o.尺寸}，总像素 ${o.总像素}`);
  console.log('\n占比归类：');
  for (const [k, v] of Object.entries(o.归类)) if (k !== '灰') console.log(`  ${k.padEnd(4)} ${v}`);
  console.log('\n前 24 名主色：');
  o.主色.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s}`));
  ws.close();
})().catch(e => { console.error(e.message); process.exit(1); });
