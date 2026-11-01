// 生成词表文档：格式「中文（english）」
const { 类型词表, 成员词表, 函数词表, 生命周期词表 } = require('./unity-words.js');
const fs = require('fs');
const path = require('path');

const 分组 = [
  ['类型（写在冒号后面）', 类型词表, '公开的 目标 : 变换'],
  ['成员（点号后面）', 成员词表, '目标.位置 = 新向量(0,0,0)'],
  ['函数 / 静态成员（直接调用）', 函数词表, '打印（"hi"）'],
  ['生命周期方法（引擎自动调用）', 生命周期词表, '无返回 开始时（）'],
];

let out = '# Unity 中文套式 · API 词表\n\n';
out += '> 格式：**中文（english）** —— 记不住看括号，编辑器里写哪个都认。\n\n';

for (const [标题, 表, 例] of 分组) {
  out += `## ${标题}\n\n`;
  out += '| 中文（english） | 例 |\n|---|---|\n';
  for (const [中, 英] of Object.entries(表)) {
    out += `| **${中}**（${英}） | \`${例}\` |\n`;
  }
  out += '\n';
}

out += '---\n\n';
out += '## 规矩\n\n';
out += '- **变量名、类名、方法名**：你自己起，可以全中文（C# 允许）\n';
out += '- **API 名**：Unity 定的，必须英文；写中文由词表自动转\n';
out += '- 词表里没有的 API，直接写英文，原样保留\n';

fs.writeFileSync(path.join(__dirname, 'UNITY-词表.md'), out, 'utf8');
console.log('已生成 UNITY-词表.md');
console.log(out.split('\n').slice(0, 20).join('\n'));
