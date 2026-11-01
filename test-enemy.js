// 用【用户画的那张图】作为输入，生成 Unity 脚本
const { 译脚本 } = require('./zh2unity.js');
const fs = require('fs');
const path = require('path');

// 第一份：用户画的图
const 敌人源码 = `使用 UnityEngine

公开的类 敌人 : MonoBehaviour

公开整数 血量 = 30
公开整数 分 = 10
公开的 目标 : 变换

无返回 开始时（）
{
    打印（"敌人已生成"）
}

公开的方法 受伤（整数 伤害）
{
    血量 = 血量 - 伤害
    打印（"血量：" + 血量）
    设若（血量 小于等于 0）
    {
        死亡（）
    }
}

无返回 死亡（）
{
    打印（"死亡，得分 +" + 分）
    设若（目标 不等于 空）
    {
        目标.位置 = 新向量（0, 0, 0）
    }
    销毁（自己，1）
}
`;

// 第二份：测更多 API 词
const 测试源码 = `使用 UnityEngine

公开的类 玩家 : MonoBehaviour

公开小数 速度 = 5.0
公开的 身体 : 刚体

无返回 更新时（）
{
    设若（按下键（"Space"））
    {
        打印（"跳"）
        身体.速度 = 新向量（0, 速度, 0）
    }
    打印（帧间隔）
}
`;

const 结果 = 译脚本(敌人源码);
console.log('=== 敌人 ===');
console.log(结果);

console.log('=== 玩家（测 API 词表）===');
console.log(译脚本(测试源码));

const 目录 = path.join(__dirname, 'unity-lab', 'Assets');
fs.mkdirSync(目录, { recursive: true });
fs.writeFileSync(path.join(目录, '敌人.cs'), 结果, 'utf8');
fs.writeFileSync(path.join(__dirname, 'unitycheck', '敌人.cs'), 结果, 'utf8');
