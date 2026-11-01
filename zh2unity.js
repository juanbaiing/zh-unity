(function () {

// ============================================================
// 中文套式 → Unity C# 脚本生成器
// 支持类结构：类 / 字段 / 方法 / 语句
// 词表独立在 unity-words.js，格式「中文（english）」
// ============================================================

// 词表来源：浏览器用 window.UnityWords，Node 用 require
const _W = (typeof window !== 'undefined' && window.UnityWords)
  ? window.UnityWords
  : require('./unity-words.js');

const { 类型词表, 成员词表, 函数词表, 生命周期词表 } = _W;

// 兼容别名
const 类型表 = { ...类型词表, '真值': 'bool' };
const 固定方法名 = 生命周期词表;

// 成员访问：目标.位置 → 目标.position；英文原样保留
function 译成员(s) {
  return s.replace(/\.([\u4e00-\u9fa5]+)/g,
    (全, 名) => (成员词表[名] ? '.' + 成员词表[名] : 全));
}

// 独立函数 / 静态成员：打印（x）→ Debug.Log(x)
const 函数名 = Object.keys(函数词表)
  .sort((a, b) => b.length - a.length)   // 长的先换，避免「打印」吃掉「打印警告」
  .map(中 => [new RegExp(中, 'g'), 函数词表[中]]);

// 内置对象
const 内置 = [
  [/自己/g, 'gameObject'],
  [/空(?![\u4e00-\u9fa5])/g, 'null'],
  [/真(?![\u4e00-\u9fa5])/g, 'true'],
  [/假(?![\u4e00-\u9fa5])/g, 'false'],
  [/新向量/g, 'new Vector3'],
];

// 中英运算符
const 运算符 = [
  [/不等于/g, '!='],
  [/大于等于|不小于/g, '>='],
  [/小于等于|不大于/g, '<='],
  [/大于/g, '>'],
  [/小于/g, '<'],
  [/等于/g, '=='],
  [/并且|而且/g, '&&'],
  [/或者/g, '||'],
  [/加上|加/g, '+'],
  [/减去|减/g, '-'],
  [/乘以|乘/g, '*'],
  [/除以|除/g, '/'],
];

// 全角 → 半角
const 标点 = {
  '（': '(', '）': ')', '［': '[', '］': ']', '｛': '{', '｝': '}',
  '，': ',', '；': ';', '：': ':', '　': ' ',
  '＜': '<', '＞': '>', '＝': '=', '＋': '+', '－': '-', '＊': '*', '／': '/',
};
function 归一(s) {
  let out = '', 引号 = false;
  for (const ch of s) {
    if (ch === '"') { 引号 = !引号; out += ch; continue; }
    out += 引号 ? ch : (标点[ch] || ch);
  }
  return out;
}

// 按键：W / 空格 / 鼠标左键 → KeyCode.W …
const 按键表 = {
  'W': 'KeyCode.W', 'A': 'KeyCode.A', 'S': 'KeyCode.S', 'D': 'KeyCode.D',
  '空格': 'KeyCode.Space', '回车': 'KeyCode.Return', '鼠标左键': 'KeyCode.Mouse0',
};
function 按键表达式(参数) {
  const [键 = 'W', 方式 = '按住'] = String(参数).split(/[，,]/).map(s => s.trim());
  const 码 = 按键表[键] || 键;
  const 法 = { '按住': 'GetKey', '按下': 'GetKeyDown', '松开': 'GetKeyUp' }[方式] || 'GetKey';
  return `Input.${法}(${码})`;
}

// 表达式翻译
function 算(式) {
  let r = 归一(式).trim();

  // 表达式位置的构造调用（写在「值」字段里也能用）
  r = r.replace(/新建列表\s*[（(]([^）)]+)[）)]/g,
    (_, 类) => {
      const 全 = 类型表[类.trim()] || 类.trim();
      return `new ${/^(List|Dictionary|HashSet)</.test(全) ? 全 : 'List<' + 全 + '>'}` + '()';
    });
  r = r.replace(/获得组件\s*[（(]([^）)]+)[）)]/g,
    (_, 类) => `GetComponent<${类型表[类.trim()] || 类.trim()}>()`);

  r = 译成员(r);
  for (const [re, to] of 函数名) r = r.replace(re, to);
  for (const [re, to] of 内置) r = r.replace(re, to);
  for (const [re, to] of 运算符) r = r.replace(re, to);
  return r;
}

// 参数表：整数 伤害, 文本 名字  →  int 伤害, string 名字
function 译参数(表) {
  if (!表.trim()) return '';
  return 表.split(/[,，]/).map(段 => {
    const p = 段.trim().split(/\s+/);
    const 类型 = 类型表[p[0]] || p[0];
    return p.length > 1 ? `${类型} ${p[1]}` : 类型;
  }).join(', ');
}

// 单行翻译；depth = 当前大括号深度
function 译一行(原行, depth) {
  const 缩进 = '    '.repeat(depth);
  const t = 归一(原行).trim().replace(/;\s*$/, '');
  if (!t) return null;
  if (t.startsWith('//')) return null;

  let m;

  // 使用 X
  m = t.match(/^使用\s+(.+)$/);
  if (m) return { 行: `using ${m[1]};`, 深: 0 };

  // 公开的类 X : Y
  m = t.match(/^公开的类\s+(\S+)(?:\s*:\s*(\S+))?$/);
  if (m) return { 行: `public class ${m[1]}${m[2] ? ' : ' + m[2] : ''}`, 深: 1 };

  // 公开<类型> 名 = 值
  m = t.match(new RegExp(`^公开(${Object.keys(类型表).join('|')})\\s+(\\S+)\\s*=\\s*(.+)$`));
  if (m) return { 行: `public ${类型表[m[1]]} ${m[2]} = ${算(m[3])};`, 深: 0 };

  // 公开的 名 : 类型（类型也吃中文词表：变换 → Transform）
  m = t.match(/^公开的\s+(\S+)\s*:\s*(\S+)$/);
  if (m) return { 行: `public ${类型表[m[2]] || m[2]} ${m[1]};`, 深: 0 };

  // 访问修饰符：公开 / 私有 / 受保护，写法和「字段」保持一致
  const 修饰表 = { '公开': 'public', '私有': 'private', '受保护': 'protected' };
  const 类型们 = Object.keys(类型表).join('|');

  for (const [中文, cs] of Object.entries(修饰表)) {
    // <修饰><类型> 名 = 值
    m = t.match(new RegExp(`^${中文}(${类型们})\\s+(\\S+)\\s*=\\s*(.+)$`));
    if (m) return { 行: `${cs} ${类型表[m[1]]} ${m[2]} = ${算(m[3])};`, 深: 0 };

    // <修饰>的 名 : 类型
    m = t.match(new RegExp(`^${中文}的\\s+(\\S+)\\s*:\\s*(\\S+)$`));
    if (m) return { 行: `${cs} ${类型表[m[2]] || m[2]} ${m[1]};`, 深: 0 };

    // <修饰>方法 方法名（参数）[返回 类型] / <修饰>的方法 方法名（参数）[返回 类型]
    const 方法头 = 中文 === '公开' ? '公开的方法' : 中文 + '方法';
    m = t.match(new RegExp(`^${方法头}\\s+(\\S+?)\\s*[（(](.*)[）)](?:\\s*返回\\s*(\\S+))?$`));
    if (m) {
      const 名 = 固定方法名[m[1]] || m[1];
      const 返 = m[3] ? (类型表[m[3]] || m[3]) : 'void';
      return { 行: `${cs} ${返} ${名}(${译参数(m[2])})`, 深: 1 };
    }
  }

  // 方法 名（参数）返回 类型 —— 不带访问修饰符但有返回类型
  m = t.match(/^方法\s+(\S+?)\s*[（(](.*)[）)](?:\s*返回\s*(\S+))?$/);
  if (m) {
    const 名 = 固定方法名[m[1]] || m[1];
    const 返 = m[3] ? (类型表[m[3]] || m[3]) : 'void';
    return { 行: `${返} ${名}(${译参数(m[2])})`, 深: 1 };
  }

  // 局部变量 x = 随机数(1,101)
  m = t.match(/^局部变量\s+(\S+)\s*=\s*随机数[（(](.+?)[）)]$/);
  if (m) return { 行: `var ${m[1]} = UnityEngine.Random.Range(${m[2]});`, 深: 0 };

  // 局部变量 x = 新建对象(玩家,"小明",100)
  m = t.match(/^局部变量\s+(\S+)\s*=\s*新建对象[（(](.*?)[）)]$/);
  if (m) {
    const 段 = m[2].split(/[,，]/);
    const 类 = (段[0] || '').trim();
    const 参 = 段.slice(1).join(',').trim();
    return { 行: `var ${m[1]} = new ${类}(${参 ? 译参数(参) : ''});`, 深: 0 };
  }

  // 设属性(transform,position,new Vector3(0,0,0))
  m = t.match(/^设属性[（(](.*?),(.*?),(.+)[）)]$/);
  if (m) return { 行: `${m[1].trim()}.${m[2].trim()} = ${m[3].trim()};`, 深: 0 };

  // 局部变量 x = 取属性(transform,position)
  m = t.match(/^局部变量\s+(\S+)\s*=\s*取属性[（(](.*?),(.*?)[）)]$/);
  if (m) return { 行: `var ${m[1]} = ${m[2].trim()}.${m[3].trim()};`, 深: 0 };

  // 在 rb 上调 Play(参数)
  m = t.match(/^在\s+(\S+)\s+上调\s+(\S+?)[（(](.*)[）)]$/);
  if (m) return { 行: `${m[1]}.${m[2]}(${m[3]});`, 深: 0 };

  // 平移(0,0,1 * Time.deltaTime) / 转动(0,1,0)
  m = t.match(/^平移[（(](.*?)[）)]$/);
  if (m) return { 行: `transform.Translate(${m[1]});`, 深: 0 };

  m = t.match(/^转动[（(](.*?)[）)]$/);
  if (m) return { 行: `transform.Rotate(${m[1]});`, 深: 0 };

  // 切换场景("关卡2")
  m = t.match(/^切换场景[（(](.*?)[）)]$/);
  if (m) return { 行: `SceneManager.LoadScene(${m[1]});`, 深: 0 };

  // 无返回 方法名（参数）[返回 类型] —— 不带访问修饰符，等于默认可见性
  m = t.match(/^无返回\s+(\S+?)\s*[（(](.*)[）)](?:\s*返回\s*(\S+))?$/);
  if (m) {
    const 名 = 固定方法名[m[1]] || m[1];
    const 返 = m[3] ? (类型表[m[3]] || m[3]) : 'void';
    return { 行: `${返} ${名}(${译参数(m[2])})`, 深: 1 };
  }

  // 设若（条件）
  m = t.match(/^设若\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `if (${算(m[1])})`, 深: 1 };

  // 否则若（条件）  —— 必须在「否则」之前判断
  m = t.match(/^否则若\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `else if (${算(m[1])})`, 深: 1 };

  // 否则
  if (/^否则$/.test(t)) return { 行: 'else', 深: 1 };

  // 跳过 / 继续
  if (/^跳出$/.test(t)) return { 行: 'break;', 深: 0 };
  if (/^继续$/.test(t)) return { 行: 'continue;', 深: 0 };

  // 多分支（值） / 遇（值） / 其他
  m = t.match(/^多分支\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `switch (${算(m[1])})`, 深: 1 };

  m = t.match(/^遇\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `case ${算(m[1])}:`, 深: 1 };

  if (/^其他$/.test(t)) return { 行: 'default:', 深: 1 };

  // 尝试 / 捕获
  if (/^尝试$/.test(t)) return { 行: 'try', 深: 1 };
  if (/^捕获$/.test(t)) return { 行: 'catch', 深: 1 };

  // 加一（x） / 减一（x）
  m = t.match(/^加一\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}++;`, 深: 0 };
  m = t.match(/^减一\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}--;`, 深: 0 };

  // 局部变量 名 = 值
  m = t.match(/^局部变量\s+(\S+)\s*=\s*(.+)$/);
  if (m) return { 行: `var ${m[1]} = ${算(m[2])};`, 深: 0 };

  // 新建列表（类型）—— 单独成句，C# 里不合法，留着只为兼容老文件
  m = t.match(/^新建列表\s*[（(](.+?)[）)]$/);
  if (m) {
    const 全 = 类型表[m[1]] || m[1];
    return { 行: `// 新建列表要接到一个变量上（用「存到」）`, 深: 0 };
  }

  // 设置激活（对象，真/假）
  m = t.match(/^设置激活\s*[（(](.+?)\s*[，,]\s*(.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}.SetActive(${算(m[2])});`, 深: 0 };

  // 公开的属性（可读可写 / 只读）
  m = t.match(/^公开属性\s+(\S+)\s+(\S+)$/);
  if (m) return { 行: `public ${类型表[m[1]] || m[1]} ${m[2]} { get; set; }`, 深: 0 };

  m = t.match(/^公开只读属性\s+(\S+)\s+(\S+)$/);
  if (m) return { 行: `public ${类型表[m[1]] || m[1]} ${m[2]} { get; }`, 深: 0 };

  // 构造函数 类名（参数）
  m = t.match(/^构造函数\s+(\S+?)\s*[（(](.*)[）)]$/);
  if (m) return { 行: `public ${m[1]}(${译参数(m[2])})`, 深: 1 };

  // 数组 整数 名单 = 新数组（1，2，3）
  m = t.match(/^数组\s+(\S+)\s+(\S+)\s*=\s*新数组\s*[（(](.*)[）)]$/);
  if (m) return { 行: `${类型表[m[1]] || m[1]}[] ${m[2]} = { ${m[3]} };`, 深: 0 };

  // 添加（列表，值）
  m = t.match(/^添加\s*[（(](.+?)\s*[，,]\s*(.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}.Add(${算(m[2])});`, 深: 0 };

  // 删除第几个（列表，下标）
  m = t.match(/^删除第几个\s*[（(](.+?)\s*[，,]\s*(.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}.RemoveAt(${算(m[2])});`, 深: 0 };

  // 清空（列表）
  m = t.match(/^清空\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `${算(m[1])}.Clear();`, 深: 0 };

  // 读按键（W）  后面会跟自己一个大括号
  m = t.match(/^读按键\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `if (${按键表达式(m[1])})`, 深: 1 };

  // 只要（条件）
  m = t.match(/^只要\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `while (${算(m[1])})`, 深: 1 };

  // 重复（次数）
  m = t.match(/^重复\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `for (int i = 0; i < ${算(m[1])}; i++)`, 深: 1 };

  // 遍历（列表 中 x）
  m = t.match(/^遍历\s*[（(](.+?)\s*(?:的|中)\s*(\S+?)[）)]$/);
  if (m) return { 行: `foreach (var ${m[2]} in ${算(m[1])})`, 深: 1 };

  // 打印（...）
  m = t.match(/^打印\s*[（(](.+?)[）)]$/);
  if (m) return { 行: `Debug.Log(${算(m[1])});`, 深: 0 };

  // 返回 X
  m = t.match(/^返回\s+(.+)$/);
  if (m) return { 行: `return ${算(m[1])};`, 深: 0 };

  // 结束块 / 右括号
  if (t === '}' || t === '结束') return { 行: '}', 深: -1 };

  // 单独一行 { ：块头的 { 由生成器自动补，这里吞掉，不然会出现两个 {
  if (t === '{') return null;

  // 其他：普通语句
  const 式 = 算(t);
  return { 行: 式.endsWith(';') ? 式 : `${式};`, 深: 0 };
}

// 翻译整份脚本
function 译脚本(中文源码) {
  const 结果 = [];
  let depth = 0;

  for (const 原行 of 中文源码.split(/\r?\n/)) {
    const 原缩进 = 原行.match(/^\s*/)[0];
    const 判 = 译一行(原行, depth);
    if (!判) { continue; }

    if (判.深 === -1) {
      depth = Math.max(0, depth - 1);
      结果.push('    '.repeat(depth) + 判.行);
      continue;
    }

    结果.push('    '.repeat(depth) + 判.行);
    if (判.深 === 1) {
      结果.push('    '.repeat(depth) + '{');
      depth += 1;
    }
  }

  // 收尾：没关掉的块补上
  while (depth > 0) {
    depth -= 1;
    结果.push('    '.repeat(depth) + '}');
  }

  let 文 = 结果.join('\n') + '\n';

  // 用到 List 就自动补 using —— 否则 new List<int>() 编译不过
  if (/\bList</.test(文) && !文.includes('using System.Collections.Generic')) {
    文 = 'using System.Collections.Generic;\n' + 文;
  }

  return 文;
}

if (typeof window !== 'undefined') window.Zh2Unity = { 译脚本, 译一行 };
if (typeof module !== 'undefined') module.exports = { 译脚本, 译一行 };

})();
