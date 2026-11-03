// 量编辑器 CSS 里的间距/字号/圆角到底有多乱。
// 判据来自 2026-11-03 的三轮搜索，核心一句：
//   「Templates use arbitrary padding. 15px here, 24px there, 40px somewhere else.
//     Your eye detects the inconsistency subconsciously. It registers as "cheap".」
// 所以这里数的不是"有多少像素"，是"有几个不在 4px 网格上的值"、"有几个档位差不到 2px"。
//
// ⚠️ 上一版这些正则全匹配不到：我在写文件时把 \b 写成了字面 \b，
//    文件里存进去的是真正的退格字符 —— 正则变成 /[退格]padding:/，当然匹配不到。
//    这次不用 \b，改用 [;{ ]padding: 这种显式前导。
const fs = require('fs');
const t = fs.readFileSync('D:/dswork/zh-csharp-lab/editor2.html', 'utf8');
const css = t.slice(t.indexOf('<style>'), t.indexOf('</style>'));

const 网格4 = v => Math.abs(v / 4 - Math.round(v / 4)) < 0.01;

function 取(名, 前导, 属性) {
  const re = new RegExp('(?:' + 前导 + ')' + 属性 + '\\s*:\\s*(-?[0-9.]+)px', 'g');
  const 值 = [];
  let m;
  while ((m = re.exec(css))) {
    const v = parseFloat(m[1]);
    if (!isNaN(v) && v !== 0) 值.push(Math.abs(v));
  }
  const 计 = {};
  值.forEach(v => 计[v] = (计[v] || 0) + 1);
  const 列 = Object.entries(计).map(([k, n]) => [Number(k), n]).sort((a, b) => a[0] - b[0]);
  const 破 = 列.filter(([v]) => !网格4(v));
  console.log(`\n${名}：${列.length} 种取值 / ${值.length} 处`);
  console.log('  ' + 列.map(([v, n]) => v + '×' + n + (网格4(v) ? '' : '✗')).join('  '));
  console.log(`  不在 4px 网格上：${破.length} 种 / ${破.reduce((s, [, n]) => s + n, 0)} 处` +
    (破.length ? '  → ' + 破.map(([v, n]) => v + '×' + n).join(', ') : ''));
  return { 种: 列.length, 处: 值.length, 破种: 破.length, 破处: 破.reduce((s, [, n]) => s + n, 0) };
}

// 前导字符类。不能用 (?:;{\r\n ) 那种字面序列 —— 那要求这五个字符连着出现，
// 永远匹配不到。必须是 [;{ \r\n] 这样的字符类。
const 前导 = '[;{ \\r\\n]';
const 结 = {};
结['padding'] = 取('padding', 前导, 'padding');
结['gap'] = 取('gap', 前导, 'gap');
结['margin'] = 取('margin', 前导, 'margin(?:-top|-bottom|-left|-right)?');
结['圆角'] = 取('border-radius', 前导, 'border-radius');
结['字号'] = 取('font-size', 前导, 'font-size');
结['行高'] = 取('line-height', 前导, 'line-height');

console.log('\n──────── 汇总 ────────');
let 总破 = 0, 总处 = 0, 总种 = 0;
for (const [k, v] of Object.entries(结)) {
  总破 += v.破处; 总处 += v.处; 总种 += v.种;
  console.log(`  ${k.padEnd(12)} ${String(v.种).padStart(2)} 种 / ${String(v.处).padStart(3)} 处，其中破 4px 网格 ${v.破处} 处`);
}
console.log(`\n合计：${总种} 种不同取值，${总处} 处声明，${总破} 处不在 4px 网格上`);

// 字号档位：深色底上 600 以下的字重差看不见，所以只能靠字号拉层次。
// 档位差不到 2px，眼睛就分不出来 —— 加了等于没加。
const 字号 = 结['字号'];
const re = new RegExp('(?:' + 前导 + ')font-size\\s*:\\s*([0-9.]+)px', 'g');
const 档 = [...new Set((css.match(re) || []).map(x => parseFloat(x.match(/([0-9.]+)px/)[1])))].sort((a, b) => a - b);
console.log(`\n字号档位：${档.join(', ')}   共 ${档.length} 档`);
const 近 = 档.slice(1).map((v, i) => [v - 档[i], 档[i], v]).filter(([d]) => d < 2);
console.log(`  差不到 2px 的相邻档：${近.length} 对` + (近.length ? ' → ' + 近.map(([d, a, b]) => a + '/' + b).join(', ') : ''));
console.log(`  按搜索到的做法，字重和字号只该有 4 档左右 —— 现在 ${档.length} 档，${近.length} 对眼睛分不出来`);
