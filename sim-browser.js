// 模拟浏览器：三个脚本按 <script> 顺序加载，检查导出能否调用
global.window = {};

require('./translator.js');
require('./unity-words.js');
require('./zh2unity.js');

const 检查 = [
  ['window.翻译', typeof window.翻译],
  ['window.翻译Unity', typeof window.翻译Unity],
  ['window.UnityWords', typeof window.UnityWords],
  ['window.Zh2Unity', typeof window.Zh2Unity],
];
for (const [名, 型] of 检查) console.log(`${名}: ${型}`);

// 真的调一次，模拟编辑器里发生的翻译
const 源码 = `使用 UnityEngine

公开的类 敌人 : MonoBehaviour

公开整数 血量 = 30
公开的 目标 : 变换

无返回 开始时（）
{
    打印（"开打"）
}
`;

console.log('\n--- Unity 模式输出 ---');
console.log(window.Zh2Unity.译脚本(源码));

console.log('--- 语句模式输出 ---');
console.log(window.翻译('打印（1）'));
