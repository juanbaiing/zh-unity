// 翻译器自测：把中文套式翻译成 C#，然后真的编译运行
const { 翻译 } = require('./translator.js');
const fs = require('fs');
const path = require('path');

const 中文源码 = `
定义 列表 = new[] { 1, 2, 3, 4, 5 }

遍历（列表 中 x）{
    设若（x 大于 2）{
        打印（x）
    } 否则 {
        打印（0）
    }
}
`;

const 生成的CSharp = 翻译(中文源码);
console.log('=== 翻译结果 ===');
console.log(生成的CSharp);
console.log('=== 结束 ===');

// 写进 demo 项目里编译运行
const target = path.join(__dirname, 'demo', 'Program.cs');
fs.writeFileSync(target, 生成的CSharp, 'utf8');
console.log('\n已写入 ' + target);
