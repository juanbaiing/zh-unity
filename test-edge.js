const { 翻译 } = require('./translator.js');

const 用例 = [
  ['定义 列表 = new[] { 1, 2 }', 'var list = new[] { 1, 2 };'],
  ['定义 列表', '⚠ 该报错'],           // 少了 = 值
  ['打印 列表', '⚠ 该报错'],            // 少了括号
  ['总数 = 总数 + 1', '总数 = 总数 + 1;'], // 普通赋值，允许
];

for (const [输入, 期望] of 用例) {
  console.log(JSON.stringify(输入), '=>', JSON.stringify(翻译(输入)));
}
