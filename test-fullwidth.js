const { 翻译 } = require('./translator.js');

// 全角标点满天飞的版本
const 源码 = `定义 列表 = new[] ｛ 1，2，3，4，5 ｝；

遍历（列表 中 x）｛
    设若（x 大于 2）｛
        打印（x）；
    ｝否则｛
        打印（0）；
    ｝
｝

x＝0；

只要（x 小于 3）
｛
    打印（x）；
    x＝x＋1；
｝
`;

console.log('=== 全角标点版本 ===');
console.log(翻译(源码));
