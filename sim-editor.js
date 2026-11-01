// 模拟浏览器：按 <script> 顺序加载四个脚本，检查出口与块树生成
global.window = {};

require('./translator.js');
require('./unity-words.js');
require('./zh2unity.js');
require('./blocks.js');

console.log('出口检查：');
for (const 名 of ['翻译', 'UnityWords', 'Zh2Unity', 'Blocks']) {
  console.log(`  window.${名}: ${typeof window[名]}`);
}

const { 新块, 生成中文, 生成CSharp } = window.Blocks;

// 复刻 block-editor.html 里预置的那棵树
const 类 = 新块('类'); 类.名 = '敌人'; 类.继承 = 'MonoBehaviour';
const 血 = 新块('字段'); 血.数据类型 = '整数'; 血.名 = '血量'; 血.值 = '30';
const 分 = 新块('字段'); 分.数据类型 = '整数'; 分.名 = '分'; 分.值 = '10';
const 目 = 新块('字段'); 目.数据类型 = '变换'; 目.名 = '目标';
const 开 = 新块('方法'); 开.名 = '开始时';
const 打 = 新块('打印'); 打.值 = '"敌人已生成"';
开.子.push(打);
const 受 = 新块('方法'); 受.名 = '受伤'; 受.参数 = '整数 伤害'; 受.公开 = true;
const 减 = 新块('赋值'); 减.左 = '血量'; 减.右 = '血量 - 伤害';
const 判 = 新块('设若'); 判.条件 = '血量 小于等于 0';
const 调 = 新块('调用'); 调.名 = '死亡';
判.子.push(调);
受.子.push(减, 判);
类.子.push(血, 分, 目, 开, 受);

console.log('\n--- 块树 → 中文 ---');
console.log(生成中文([类]));

console.log('--- 块树 → C# ---');
console.log(生成CSharp([类]));
