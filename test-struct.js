// 新结构块（多分支 / 尝试捕获 / 自由语句）的端到端测试
const { 新块, 生成中文, 生成CSharp } = require('./blocks.js');
const fs = require('fs');
const path = require('path');

const 类 = 新块('类'); 类.名 = '敌人'; 类.继承 = 'MonoBehaviour';
const 血 = 新块('字段'); 血.数据类型 = '整数'; 血.名 = '血量'; 血.值 = '30';

// 方法1：自由语句 + 多分支
const 看状态 = 新块('方法'); 看状态.名 = '更新时';
const 自由 = 新块('自由语句'); 自由.内容 = '血量 = 血量 - 1';
const 多 = 新块('多分支'); 多.值 = '血量';
const 遇1 = 新块('遇'); 遇1.值 = '30';
const 打印A = 新块('打印'); 打印A.值 = '"满血"';
const 跳1 = 新块('跳出');
遇1.子.push(打印A, 跳1);
const 其他 = 新块('其他');
const 打印B = 新块('打印'); 打印B.值 = '"受伤"';
其他.子.push(打印B);
多.子.push(遇1, 其他);
看状态.子.push(自由, 多);

// 方法2：尝试捕获
const 试 = 新块('方法'); 试.名 = '重置'; 试.公开 = true;
const 尝试块 = 新块('尝试');
const 赋值 = 新块('赋值'); 赋值.左 = '血量'; 赋值.右 = '100';
尝试块.子.push(赋值);
const 捕获块 = 新块('捕获');
const 报错 = 新块('报错'); 报错.值 = '"重置失败"';
捕获块.子.push(报错);
试.子.push(尝试块, 捕获块);

类.子.push(血, 看状态, 试);

const 中文 = 生成中文([类]);
const CSharp = 生成CSharp([类]);

console.log('=== 中文 ===');
console.log(中文);
console.log('\n=== C# ===');
console.log(CSharp);

fs.writeFileSync(path.join(__dirname, 'unitycheck', '敌人.cs'), CSharp, 'utf8');
console.log('已写入 unitycheck/敌人.cs');
