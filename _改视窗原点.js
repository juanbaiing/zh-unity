// 把「视窗原点」从写死的 1400×860 改成按内容包围盒算。
//
// 为什么：原点不只是初始视野，它还是「复位」要回的地方、以及档位判据的分母。
// 写死 1400 的话，实例一多就散到画布外面，按复位也只能看见一部分 ——
// 用户看到的就是「东西少了」，而不是「缩小了」。
const fs = require('fs');

const 旧 = `const 原点 = { x: 0, y: 0, w: 1400, h: 860 };
const 视 = { ...原点 };`;

const 新 = `// 视窗按内容包围盒定，不写死 1400×860。
// 原点是三样东西：初始视野、「复位」回的地方、档位判据的分母。
// 写死的话实例一多就散到画布外，一按复位就再也找不全 —— 看着像"东西没了"。
const 原点 = (function () {
  const 画r = 画布.getBoundingClientRect();
  const 窗比 = (画r.width || 1400) / (画r.height || 860);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const 实 of 场景.实例们) {
    x0 = Math.min(x0, 实.x); y0 = Math.min(y0, 实.y);
    x1 = Math.max(x1, 实.x + 实.w); y1 = Math.max(y1, 实.y + 实.h);
  }
  if (!(x1 > x0)) return { x: 0, y: 0, w: 1400, h: 860 };
  const 边 = 70;
  let w = x1 - x0 + 边 * 2, h = y1 - y0 + 边 * 2;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // 跟窗口同宽高比，否则 preserveAspectRatio 会留一条边
  if (w / h < 窗比) w = h * 窗比; else h = w / 窗比;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
})();
const 视 = { ...原点 };`;

for (const p of ['D:/dswork/zh-csharp-lab/数据层/图模板.html', 'D:/dswork/unity-graph-lab/实例图.html']) {
  const 原件 = fs.readFileSync(p, 'utf8');
  const 是CRLF = 原件.includes('\r\n');
  let s = 原件.replace(/\r\n/g, '\n');
  if (!s.includes(旧)) { console.log(`⚠ ${p.split('/').pop()}：没找到原点定义，跳过`); continue; }
  s = s.replace(旧, 新);
  fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  console.log(`✓ ${p.split('/').pop()}  原点改为包围盒`);
}
