// 窗户 = 那个实例框在屏幕上的矩形，一字不差。
//
// 之前我做成了「从框往右下铺到舞台边」—— 那是**在框外面**浮一块板子，
// 不是「框内部变成编辑器」。用户要的是后者：
//   框占满屏幕 → 框里面就是编辑器画布。
// 所以窗口的 left/top/宽/高 直接取实例框的 getBoundingClientRect()，
// 视觉上就是框本身换了一副内脏；框多大，画布多大，框占满屏幕画布就占满屏幕。
// 仍然钳在舞台里 —— 框放大后可能有一部分越出视口，画布不能被带出去。
//
// 同时把「够大」的判据改成**实例框占屏幕的比例**（≥80% 宽），
// 这才是用户说的「当这个框占满屏幕后」。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');
const 前 = s;

// ① 判据：实例框占屏幕的比例，不是字号
const 旧判 = [
  'function 屏幕字号() { return 14 * (视.z || 1); }',
  'function 够大() { return 屏幕字号() >= 24; }',
].join('\n');
const 新判 = [
  '// 判据：这个实例框在屏幕上占多宽。占满（≥80% 舞台宽）才让内部变成画布 ——',
  '// 这是「当这个框占满屏幕后」那句话的直接翻译，不是拍脑袋的倍率。',
  'function 框够大(实例el) {',
  '  if (!实例el) return false;',
  '  const r = 实例el.getBoundingClientRect();',
  '  const 台 = 舞台.getBoundingClientRect();',
  '  return r.width >= 台.width * 0.8;',
  '}',
].join('\n');
if (!s.includes(旧判)) { console.error('❌ 判据没匹配'); process.exit(1); }
s = s.replace(旧判, 新判);

// ② 开窗：尺寸 = 实例框矩形
const 旧尺起 = '  // 窗户是**这个脚本框的窗口**：从脚本框的位置出发，往右下铺到舞台边缘。';
const 旧尺终 = "  w.style.height = Math.round(台.bottom - 上 - 边) + 'px';";
const i0 = s.indexOf(旧尺起), i1 = s.indexOf(旧尺终);
if (i0 < 0 || i1 < 0) { console.error('❌ 尺寸段没匹配'); process.exit(1); }
const 新尺 = [
  '  // 窗户 = 这个实例框在屏幕上的矩形，一字不差。',
  '  // 视觉上就是「框里面换成了编辑器」，框多大画布多大；框占满屏幕，画布就占满屏幕。',
  '  // 但仍钳在舞台里 —— 框放大后可能有一部分越出视口，画布不能被带到看不见的地方。',
  '  const 台 = 舞台.getBoundingClientRect();',
  '  const 框r = 实例el.getBoundingClientRect();',
  '  const 左 = Math.max(台.left, Math.min(框r.left, 台.right - 240));',
  '  const 上 = Math.max(台.top, Math.min(框r.top, 台.bottom - 160));',
  '  const 右 = Math.min(台.right, Math.max(框r.right, 左 + 240));',
  '  const 下 = Math.min(台.bottom, Math.max(框r.bottom, 上 + 160));',
  "  w.style.left = Math.round(左) + 'px';",
  "  w.style.top = Math.round(上) + 'px';",
  "  w.style.width = Math.round(右 - 左) + 'px';",
  "  w.style.height = Math.round(下 - 上) + 'px';",
].join('\n');
s = s.slice(0, i0) + 新尺 + s.slice(i1 + 旧尺终.length);

// ③ 开窗入口的判据调用
s = s.replace(
  '  if (!够大()) {\n    网提示(`放大到最大等级再开 —— 现在字号 ${屏幕字号().toFixed(0)}px，要 24px`);\n    return;\n  }',
  '  if (!框够大(实例el)) {\n    网提示(\'把这个框放大到占满屏幕，再点它内部的编辑\');\n    return;\n  }'
);

// ④ 实例框头加一个「✎」按钮 —— 占满屏幕之后点它，内部变成画布
const 旧头 = `  const 签 = document.createElement('span');
  签.className = '实例签';
  签.textContent = (实.tag || 'Untagged') + ' · L' + (实.层 ?? 0);
  头.appendChild(名);
  头.appendChild(签);`;
const 新头 = `  const 签 = document.createElement('span');
  签.className = '实例签';
  签.textContent = (实.tag || 'Untagged') + ' · L' + (实.层 ?? 0);
  // 「框占满屏幕后，内部改为编辑器画布」—— 这个按钮就是那句话里的「按一个按钮」。
  // 不用自动：自动切换会在你只想看数据的时候被强行夺走视线。
  const 编钮 = document.createElement('span');
  编钮.className = '编钮';
  编钮.textContent = '✎ 编辑';
  编钮.title = '把这个框的内部变成编辑器画布（要先放大到占满屏幕）';
  编钮.addEventListener('click', e => {
    e.stopPropagation();
    const 首个 = (实.脚本 || [])[0];
    if (!首个) { 网提示('这个实例上没挂脚本'); return; }
    if (窗.el && 窗.实例 === 实.id) { 关窗(); return; }
    开窗(el, 首个.名);
  });
  头.appendChild(名);
  头.appendChild(签);
  头.appendChild(编钮);`;

if (!s.includes(旧头)) { console.error('❌ 实例头没匹配'); process.exit(1); }
s = s.replace(旧头, 新头);

// ⑤ 按钮样式
s = s.replace('  .实例签{color:var(--字4);font-size:var(--字标)}',
`  .实例签{color:var(--字4);font-size:var(--字标);margin-left:auto}
  .编钮{color:#6f8aa3;font-size:var(--字标);cursor:pointer;padding:2px 8px;
    border:1px solid var(--line);border-radius:4px;white-space:nowrap}
  .编钮:hover{color:var(--字1);border-color:#6f8aa3}`);

if (s === 前) { console.error('❌ 什么都没改'); process.exit(1); }
fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('窗户改成「框内部」；判据改成框占屏幕比例；加了 ✎ 编辑按钮');
