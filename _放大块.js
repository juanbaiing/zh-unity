// 把块放大。用户一句「框太小了」。
//
// 量出来的实情（z=0.888 时）：
//   字号 12px  → 屏幕上 10.7px
//   输入框 82×20 → 屏幕上 73×18
//   块头高 28   → 屏幕上 25
// 代码编辑器常见正文 13~14px，10.7 确实太小 —— 而且还要再乘缩放。
//
// 放大时守住上一轮定下的规矩，不重新乱一遍：
//   字号只动档位值，不动档数（仍是 3 档），相邻差 keep ≥2px
//   内边距 / 输入框高 / 行高 都落在 4px 网格上
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');

const 前 = s;

// ── 1. 三档字号整体上调：10/12/14 → 11/14/17 ──
//    相邻差从 2px 拉到 3px，屏幕上更好分。
s = s.replace('    --字块名:14px;       /* 块名、标题 */', '    --字块名:17px;       /* 块名、标题 */');
s = s.replace('    --字正文:12px;       /* 正文、输入的值 */', '    --字正文:14px;       /* 正文、输入的值 */');
s = s.replace('    --字标:10px;         /* 类型标签、序号 */', '    --字标:11px;         /* 类型标签、序号 */');

// 把所有写死字号换成令牌，以后只改一处
s = s.replace(/font-size:10px/g, 'font-size:var(--字标)');
s = s.replace(/font-size:12px/g, 'font-size:var(--字正文)');
s = s.replace(/font-size:14px/g, 'font-size:var(--字块名)');

// ── 2. 输入框：20 高 → 28 高，行高 24（4 的倍数），左右内边距 5 → 8 ──
s = s.replace(
  'outline:none;background:var(--槽);font-size:var(--字正文);font-family:inherit;\n    height:20px;line-height:20px;vertical-align:middle;cursor:text}',
  'outline:none;background:var(--槽);font-size:var(--字正文);font-family:inherit;\n    height:28px;line-height:24px;vertical-align:middle;cursor:text}'
);
s = s.replace('border-radius:4px;padding:0 5px;color-scheme:dark;', 'border-radius:4px;padding:0 8px;color-scheme:dark;');

// ── 3. 块头内边距 4 → 8（上下），让上下留白跟上字号 ──
s = s.replace(
  '.head{display:flex;align-items:center;gap:4px;padding:4px 8px;flex-wrap:nowrap;',
  '.head{display:flex;align-items:center;gap:8px;padding:8px 12px;flex-wrap:nowrap;'
);
s = s.replace(
  '.branch .head{cursor:default}',
  '.branch .head{padding:8px 12px;cursor:default}'
);

// ── 4. 块最小宽度 150 → 240 ──
//    150 是给 10.7px 的字定的，放大后一行塞不下几个格子。
s = s.replace('min-width:150px;z-index:2}', 'min-width:240px;z-index:2}');

// ── 5. 序号那一小格跟着放大（它有自己的 min-width 和右边框） ──
s = s.replace('.ord{font-size:var(--字标);color:var(--dim);min-width:14px;',
              '.ord{font-size:var(--字标);color:var(--dim);min-width:20px;');

// ── 6. 内容区左右 margin 跟着块内边距走 ──
s = s.replace('.body{position:relative;margin:0 8px 10px 16px;',
              '.body{position:relative;margin:0 12px 12px 20px;');

if (s === 前) { console.error('❌ 什么都没改到'); process.exit(1); }
fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');

// ── 自检：放大可以，别又把系统搞乱 ──
const 后 = fs.readFileSync(p, 'utf8');
const css = 后.slice(后.indexOf('<style>'), 后.indexOf('</style>'));
const 档 = [...new Set((css.match(/--字(?:块名|正文|标):\s*([0-9.]+)px/g) || []).map(x => parseFloat(x.match(/([0-9.]+)px/)[1])))].sort((a, b) => a - b);
const 破 = (css.match(/(?:[;{ \r\n])(?:padding|margin|gap)\s*:\s*[^;}]*?\b([0-9]+)px/g) || [])
  .map(x => parseInt(x.match(/([0-9]+)px/)[1])).filter(v => v % 4 !== 0);
console.log(`字号档位 ${档.join('/')}（${档.length} 档，相邻差 ${档.slice(1).map((v, i) => v - 档[i]).join('/')}px）`);
console.log(`间距里不在 4px 网格上的：${[...new Set(破)].join(',') || '无'}`);
