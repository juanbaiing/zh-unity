// 把三个脚本包进 IIFE，避免浏览器全局作用域重名
const fs = require('fs');

const 文件们 = ['translator.js', 'unity-words.js', 'zh2unity.js'];

for (const f of 文件们) {
  let 源 = fs.readFileSync(f, 'utf8');

  if (源.startsWith('(function')) {
    console.log(`${f}: 已包裹，跳过`);
    continue;
  }

  源 = '(function () {\n\n' + 源.trimEnd() + '\n\n})();\n';
  fs.writeFileSync(f, 源, 'utf8');
  console.log(`${f}: 已包进 IIFE`);
}
