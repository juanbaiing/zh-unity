// 完整示例：翻译 → 写入 → 编译运行
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

重复（3）{
    打印（"喘口气"）
}
`;

const 生成的CSharp = 翻译(中文源码);
console.log('=== 翻译结果 ===');
console.log(生成的CSharp);

fs.writeFileSync(path.join(__dirname, 'demo', 'Program.cs'), 生成的CSharp, 'utf8');
console.log('\n已写入 demo/Program.cs');
