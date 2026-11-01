// 新分类 + 新块 + using 的端到端验证
const { 新块, 生成中文, 生成CSharp, 按组归类 } = require('./blocks.js');
const fs = require('fs');
const path = require('path');

console.log('=== 分组 ===');
const g = 按组归类();
let n = 0;
for (const [k, v] of Object.entries(g)) {
  if (v.length) { n += v.length; console.log(`${k}(${v.length}): ${v.join(' ')}`); }
}
console.log('总计 ' + n);

// ---- 搭一个用到新结构的类 ----
const 类 = 新块('类'); 类.名 = '玩家'; 类.继承 = 'MonoBehaviour';

const 血 = 新块('字段'); 血.数据类型 = '整数'; 血.名 = '血量'; 血.值 = '100';
const 速 = 新块('属性'); 速.数据类型 = '小数'; 速.名 = '速度'; 速.读写 = '只读';
const 名单 = 新块('数组'); 名单.数据类型 = '整数'; 名单.名 = '分数表'; 名单.内容 = '1，2，3';
// 要 Add 必须用列表，数组没有 Add
const 队 = 新块('字段'); 队.数据类型 = '整数列表'; 队.名 = '队伍'; 队.值 = '';

const 绑 = 新块('方法'); 绑.名 = '开始时';
const 组件 = 新块('获得组件'); 组件.存到 = '刚体'; 组件.类型 = '刚体';
绑.子.push(组件);

const 跑 = 新块('方法'); 跑.名 = '更新时';
const 按W = 新块('读按键'); 按W.键 = 'W'; 按W.方式 = '按住';
const 动 = 新块('改变量'); 动.名 = '血量'; 动.运算法 = '减一'; 动.值 = '';
按W.子.push(动);

const 按D = 新块('读按键'); 按D.键 = 'D'; 按D.方式 = '按下';
const 加 = 新块('添加'); 加.名 = '队伍'; 加.值 = '10';
按D.子.push(加);

跑.子.push(按W, 按D);

类.子.push(血, 速, 名单, 队, 绑, 跑);

const 中文 = 生成中文([类]);
const CSharp = 生成CSharp([类]);

console.log('\n=== 中文 ===');
console.log(中文);
console.log('\n=== C# ===');
console.log(CSharp);

fs.writeFileSync(path.join(__dirname, 'unitycheck', '敌人.cs'), CSharp, 'utf8');
console.log('已写入 unitycheck/敌人.cs');
