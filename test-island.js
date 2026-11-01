const { 生成中文, 找孤岛 } = require('./canvas.js');

function 搭(链, 容器内额外) {
  const 表 = new Map();
  let id = 0;
  表.set(++id, { id, 类型: '类', 名: '敌人', 继承: 'MonoBehaviour', x: 0, y: 0, 父: null, 后: null });
    const 类 = 表.get(id);
    const 加 = (名, x, 后) => {
      const b = { id: ++id, 类型: '字段', 数据类型: '整数', 名, 值: '0', x, y: 0, 父: 类.id, 后 };
      表.set(b.id, b);
      return b;
    };
    const 块们 = 链.map(([名, x], i) => 加(名, x, null));
    // 按链顺序设置后
    链.forEach((_, i) => {
      if (i < 块们.length - 1) 块们[i].后 = 块们[i + 1].id;
    });
    return 表;
}

console.log('=== 情况1：三个都连好 ===');
console.log(生成中文(搭([['血量', 10], ['分', 20], ['变量', 30]])));
console.log('孤岛:', 找孤岛(搭([['血量', 10], ['分', 20], ['变量', 30]])).map(x => x.块.名));

console.log('\n=== 情况2：完全没连线（全在托盘里）===');
{
  const 表 = new Map();
  表.set(1, { id: 1, 类型: '类', 名: '敌人', 继承: 'MonoBehaviour', x: 0, y: 0, 父: null, 后: null });
  表.set(2, { id: 2, 类型: '字段', 数据类型: '整数', 名: '甲', 值: '1', x: 50, y: 0, 父: 1, 后: null });
  表.set(3, { id: 3, 类型: '字段', 数据类型: '整数', 名: '乙', 值: '2', x: 10, y: 0, 父: 1, 后: null });
  console.log(生成中文(表));
  console.log('孤岛:', 找孤岛(表).map(x => x.块.名));
}

console.log('\n=== 情况3：一个在托盘外 ===');
{
  const 表 = new Map();
  表.set(1, { id: 1, 类型: '类', 名: '敌人', 继承: 'MonoBehaviour', x: 0, y: 0, 父: null, 后: null });
  表.set(2, { id: 2, 类型: '字段', 数据类型: '整数', 名: '里面', 值: '1', x: 50, y: 0, 父: 1, 后: null });
  表.set(3, { id: 3, 类型: '字段', 数据类型: '整数', 名: '外面', 值: '2', x: 10, y: 0, 父: null, 后: null });
  console.log(生成中文(表));
  console.log('孤岛:', 找孤岛(表).map(x => x.块.名));
}
