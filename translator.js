(function () {

// ============================================================
// 中文套式 → C# 翻译器（核心逻辑，浏览器与 Node 通用）
// ============================================================

// 输出目标：'console' = 控制台程序，'unity' = Unity 的 MonoBehaviour
let 输出目标 = 'console';
function 设目标(t) { 输出目标 = t; }

// 打印：控制台 vs Unity 两条命
function 打印调用(参数) {
  return 输出目标 === 'unity'
    ? `Debug.Log(${参数});`
    : `Console.WriteLine(${参数});`;
}

// 标识符字典：中文名 → 英文名（可自行扩）
const IDENT = {
  '数字们': 'numbers',
  '数字': 'num',
  '列表': 'list',
  '结果': 'result',
  '平方们': 'squares',
  '总和': 'total',
  '总数': 'total',
  '总': 'sum',
  '数': 'n',
  '值': 'value',
  '文本': 'text',
};

// 中文运算符 → C#（长词在前，避免「大于等于」被「大于」吃掉）
const OPS = [
  [/不等于/g, '!='],
  [/大于等于|不小于/g, '>='],
  [/小于等于|不大于/g, '<='],
  [/大于/g, '>'],
  [/小于/g, '<'],
  [/等于/g, '=='],
  [/并且|而且/g, '&&'],
  [/或者/g, '||'],
  [/取余/g, '%'],
  [/加上|加/g, '+'],
  [/减去|减/g, '-'],
  [/乘以|乘/g, '*'],
  [/除以|除/g, '/'],
];

// 把中文标识符换成英文名。
// 关键：必须按「整个标识符」替换，不能做子串替换——
// 否则「总数」会被拆成「总」+「数」→ "sumn"，把词毁掉。
function 换标识符(s) {
  return s.replace(/[A-Za-z_][A-Za-z0-9_]*|[一-龥]+/g, 词 => IDENT[词] || 词);
}

// 全角标点 → 半角。引号里的内容不动（那是字符串，不能改）。
const 标点表 = {
  '（': '(', '）': ')', '［': '[', '］': ']', '｛': '{', '｝': '}',
  '，': ',', '；': ';', '：': ':', '、': ',', '　': ' ',
  '＜': '<', '＞': '>', '＝': '=', '＋': '+', '－': '-', '＊': '*', '／': '/',
};
function 归一化标点(s) {
  let out = '', 在引号里 = false;
  for (const ch of s) {
    if (ch === '"') { 在引号里 = !在引号里; out += ch; continue; }
    out += 在引号里 ? ch : (标点表[ch] || ch);
  }
  return out;
}

// 表达式：运算符 + 标识符 + 全角标点转半角
function 翻表达式(s) {
  let r = s.trim();
  r = 换标识符(r);
  for (const [re, to] of OPS) r = r.replace(re, to);
  r = 归一化标点(r);
  return r;
}

// 单行翻译（保留原缩进）
function 翻一行(line) {
  const indent = line.match(/^\s*/)[0];
  // 全角标点先归一：括号、分号、逗号、等号……不管怎么打都认
  // 行尾分号统一剥掉，由生成侧决定加不加，避免出现 ;;
  const t = 归一化标点(line.trim()).replace(/;\s*$/, '');
  const 包 = code => code === '' ? '' : indent + code;

  // 空行 / 注释：丢掉
  if (!t) return '';
  if (t.startsWith('//') || t.startsWith('# ')) return '';

  let m;

  // —— 块开始 ——
  // 括号半角/全角都收；行尾的 { 可写可不写
  const 开 = '[（(]', 闭 = '[）)]', 括号行 = `^([^（(]+)${开}(.+?)${闭}\\s*\\{?\\s*$`;

  // 遍历（列表 中 x）{   （与中文教材对齐：foreach 就叫「遍历」）
  m = t.match(new RegExp(`^遍历${开}(.+?)\\s*(?:的|中)\\s*(?:每一个\\s*)?(\\w+)${闭}\\s*\\{?\\s*$`));
  if (m) return 包(`foreach (var ${m[2]} in ${翻表达式(m[1])}) {`);

  // 设若（条件）{
  m = t.match(new RegExp(`^设若${开}(.+?)${闭}\\s*\\{?\\s*$`));
  if (m) return 包(`if (${翻表达式(m[1])}) {`);

  // } 否则 {    或    否则 {
  if (/^\}\s*否则\s*\{?$/.test(t)) return 包('} else {');

  // 只要（条件）{        —— 条件成立就一直做（while）
  m = t.match(new RegExp(`^只要${开}(.+?)${闭}\\s*\\{?\\s*$`));
  if (m) return 包(`while (${翻表达式(m[1])}) {`);

  // 重复（次数）{        —— 数着次数做（for）
  m = t.match(new RegExp(`^重复${开}(.+?)${闭}\\s*\\{?\\s*$`));
  if (m) return 包(`for (int i = 0; i < ${翻表达式(m[1])}; i++) {`);

  // 定义 名 = 值
  m = t.match(/^定义\s*(\S+)\s*=\s*(.+?)\s*;?\s*$/);
  if (m) return 包(`var ${换标识符(m[1])} = ${翻表达式(m[2])};`);

  // —— 单行语句 ——
  // 打印（...）
  m = t.match(new RegExp(`^打印${开}(.+?)${闭}\\s*$`));
  if (m) return 包(打印调用(翻表达式(m[1])));

  // 返回 ...
  m = t.match(/^返回\s+(.+?)\s*$/);
  if (m) return 包(`return ${翻表达式(m[1])};`);

  // 块结束
  if (t === '}' || t === '结束') return 包('}');

  // 块头已自带 {，单独一行的 { 吞掉
  if (t === '{') return '';

  // —— 兜底 ——
  // 以这些词开头却一条规则都没匹配上，说明这行写错了。
  // 绝不假装翻译成功：明说出来，让它显眼。
  const 块首词 = ['定义', '设若', '只要', '重复', '遍历', '打印', '返回', '否则'];
  const 首词 = (t.match(/^(\S+?)(?:[\s（(]|$)/) || [])[1] || '';
  if (块首词.includes(首词)) {
    return 包(`// ⚠ 这行没认出结构，原样留着：${t}`);
  }

  // 其他：当作表达式语句落地（已有分号就不再加）
  const 式子 = 翻表达式(t);
  return 包(式子.endsWith(';') ? 式子 : `${式子};`);
}

// 翻译整段（保留原缩进）
function 翻译(text) {
  const 代码 = text.split(/\r?\n/).map(翻一行).join('\n');

  // 兜底检查：C# 里不该残留中文标识符。
  // 残留 = 这个名字还没进 IDENT 字典，编译会失败。绝不装作成功。
  const 残留 = [...new Set(
    代码.split('\n')
      .filter(l => !/^\s*\/\//.test(l))          // 跳过注释行
      .join(' ')
      .replace(/"[^"]*"/g, '""')                 // 跳过字符串字面量，那是给人看的
      .match(/[一-龥]+/g) || []
  )];

  if (!残留.length) return 代码;

  const 提示 = `// ⚠ 这些名字还没有英文名，C# 编译不过：${残留.join('、')}\n` +
               `//   到 translator.js 顶部的 IDENT 里补一行 "${残留[0]}": "英文名"\n`;
  return 提示 + 代码;
}

// 包成 Unity 的 MonoBehaviour 骨架。
// Unity 没有顶层语句：所有代码必须住在类的某个方法里（这里放 Start）。
function 翻译Unity(中文源码, 类名 = '中文脚本') {
  设目标('unity');
  const 体 = 翻译(中文源码).split('\n')
    .map(l => (l.trim() ? '        ' + l : ''))
    .join('\n');

  return [
    'using UnityEngine;',
    '',
    `public class ${类名} : MonoBehaviour`,
    '{',
    '    void Start()',
    '    {',
    体,
    '    }',
    '}',
    '',
  ].join('\n');
}

const 出口 = { 翻译, 翻译Unity, 翻一行, 翻表达式, 换标识符, 设目标 };
if (typeof window !== 'undefined') {
  window.翻译 = 翻译;
  window.翻译Unity = 翻译Unity;
}
if (typeof module !== 'undefined') module.exports = 出口;

})();
