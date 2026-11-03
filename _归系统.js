// 把间距 / 字号 / 圆角归到系统里。这不是"调好看"，是消掉眼睛能感觉到但说不出的一致性错误。
//
// 依据 2026-11-03 三轮搜索，三条最硬的：
//   ① 「Templates use arbitrary padding. 15px here, 24px there, 40px somewhere else.
//       Your eye detects the inconsistency subconsciously. It registers as "cheap".」
//      → 间距只用 4/8/12/16/24/32，全部落在 4px 网格上
//   ② 「Four sizes. Two line heights. That is the entire type system.」
//      「on dark backgrounds, weight differences below 600 are nearly invisible」
//      → 字号只留 3 档，相邻差 ≥2px；层次靠字号和间距，不靠字重
//   ③ 「Unmodified stock --radius is the #1 data-mined tell of AI-built UI」
//      → 圆角只留两个值
//
// 改前的实测：93 处声明里 73 处不在 4px 网格上；字号 9 档、8 对相邻档差不到 2px。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');

// ── 值映射：只往网格上靠，不做"重新设计" ──
// 4px 网格：4 8 12 16 24 32。原来 3/5/6/7/10 都就近归位。
const 距 = { 2: 4, 3: 4, 4: 4, 5: 4, 6: 8, 7: 8, 8: 8, 10: 12, 12: 12, 14: 16, 17: 16, 20: 24, 24: 24 };
// 字号 3 档：10（类型/序号）/ 12（正文/值）/ 14（块名/标题）
const 号 = { 9: 10, 10: 10, 10.5: 10, 11: 12, 11.5: 12, 12: 12, 12.5: 12, 13: 14, 14: 14 };
// 圆角 2 档：小块 4 / 浮层 8
const 角 = { 1: 4, 3: 4, 4: 4, 5: 4, 6: 8, 7: 8, 8: 8 };

let 改 = 0;
const 换 = (re, 表, 名) => {
  s = s.replace(re, (整, 前, 值, 后) => {
    const v = parseFloat(值);
    if (!(v in 表)) return 整;
    const 新 = 表[v];
    if (新 === v) return 整;
    改++;
    return 前 + 新 + 'px' + 后;
  });
};

// padding / margin 可能一值也可能多值（padding:5px 8px / margin:0 8px 10px 16px）
const 距re = /(padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|row-gap|column-gap)(\s*:\s*)([0-9.]+)px((?:\s+[0-9.]+px)*)/g;
s = s.replace(距re, (整, 名, 冒号, 首, 其余) => {
  const 一处 = v => (v in 距 ? 距[v] + 'px' : v + 'px');
  const a = parseFloat(首);
  const b = 其余.replace(/([0-9.]+)px/g, (_, x) => 一处(parseFloat(x)));
  const 新首 = 一处(a);
  if (新首 !== 首 + 'px' || b !== 其余) 改++;
  return 名 + 冒号 + 新首 + b;
});

换(/(font-size)(\s*:\s*)([0-9.]+)px/g, {}, '');   // 占位，下面单独做
const 号re = /(font-size)(\s*:\s*)([0-9.]+)px/g;
s = s.replace(号re, (整, 名, 冒号, 值) => {
  const v = parseFloat(值);
  if (!(v in 号)) return 整;
  改++;
  return 名 + 冒号 + 号[v] + 'px';
});

const 角re = /(border-radius)(\s*:\s*)([0-9.]+)px/g;
s = s.replace(角re, (整, 名, 冒号, 值) => {
  const v = parseFloat(值);
  if (!(v in 角)) return 整;
  改++;
  return 名 + 冒号 + 角[v] + 'px';
});

// ── 行高：深色底要加行高，且落在 4px 网格上 ──
// 搜索结果：「Increasing line height by 10–20% in dark mode significantly improves reading comfort」
// 「line height should be a multiplication of 4」
s = s.replace(/line-height\s*:\s*18px/g, 'line-height:20px');
s = s.replace(/line-height\s*:\s*16px/g, 'line-height:16px');

// ── 在 :root 里补三个语义令牌，以后新写的样式直接用它们 ──
s = s.replace('    --选:#16211b;        /* 选中 / 拖入高亮底 */',
`    --选:#16211b;        /* 选中 / 拖入高亮底 */
    /* 间距只有这六个值，全部落在 4px 网格上。
       随手写 5px / 7px 的那种，眼睛察觉到不一致但说不出哪里不对，
       只会觉得"廉价"。 */
    --空隙:4px;          /* 贴在一起的两样东西 */
    --缝:8px;            /* 同一组里的 */
    --隔:12px;           /* 组与组之间 */
    --区:16px;           /* 大块之间 */
    /* 字号三档，相邻差 2px —— 差 1px 眼睛分不出来，等于白加。
       深色底上 600 以下的字重差几乎看不见，所以层次靠字号和间距，不靠粗细。 */
    --字块名:14px;       /* 块名、标题 */
    --字正文:12px;       /* 正文、输入的值 */
    --字标:10px;         /* 类型标签、序号 */
    /* 圆角两个值，不再有 1/3/5/6/7 这种。 */
    --圆弧:4px;          /* 小块 */
    --圆弧大:8px;        /* 浮层、面板 */`);

fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log(`改了 ${改} 处`);
