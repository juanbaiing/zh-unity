// 生成 Unity 的 MonoBehaviour 文件
const { 翻译Unity } = require('./translator.js');
const fs = require('fs');
const path = require('path');

const 中文源码 = `定义 列表 = new[] { 1, 2, 3, 4, 5 }

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

const 类名 = '中文脚本';
const 结果 = 翻译Unity(中文源码, 类名);

console.log(结果);

const 目录 = path.join(__dirname, 'unity-lab', 'Assets');
fs.mkdirSync(目录, { recursive: true });
fs.writeFileSync(path.join(目录, 类名 + '.cs'), 结果, 'utf8');
console.log('已写入 ' + path.join(目录, 类名 + '.cs'));
