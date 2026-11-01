(function () {

// ============================================================
// 自由画布的数据层：块有坐标、有父、有链（后继）
// 界面只管画和拖，这里只管「怎么变成代码」+「哪些是孤岛」
// ============================================================

const 块定义 = (typeof window !== 'undefined' && window.Blocks)
  ? window.Blocks.块定义
  : require('./blocks.js').块定义;

// 容器 = 能装子块的
function 是容器(类型) {
  return !!(块定义[类型] && 块定义[类型].可容纳);
}

// ---- 生成 ----
// 块表：Map<id, 块>；块 = { id, 类型, 字段, x, y, 父, 后 }
// 父 = 所属容器；后 = 同一容器内下一个。链头 = 父存在但 前 不存在——用「后」单向表，链头靠反查
function 生成中文(块表) {
  const 全部 = [...块表.values()];

  const 子们 = 容器id => 全部.filter(b => b.父 === 容器id);

  // 找链头：在容器里，且不是任何同容器块的「后」
  const 链头 = 容器id => {
    const 集合 = 子们(容器id);
    const 后继集 = new Set(集合.map(b => b.后).filter(Boolean));
    return 集合.filter(b => !后继集.has(b.id));
  };

  const 行 = [];
  let 有类 = false;

  const 走容器 = (容器, 深) => {
    const 集合 = 子们(容器.id);
    if (!集合.length) return;

    // 顺序规则：
    //   默认按画面从上到下（y），同一高度从左到右（x）；
    //   连线优先——被指向的块一定排在指向它的块后面。
    // 这两条会打架（比如「新建变量」在下方、却被字段挡在前面），
    // 所以用拓扑排序：y 序当基础，链当约束。
    const 按位置 = (a, b) =>
      ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0));

    const 按位置排 = [...集合].sort(按位置);
    const 前驱表 = new Map();          // 块 id -> 指向它的那个块
    for (const b of 集合) {
      if (b.后) 前驱表.set(b.后, b);
    }

    const 出过 = new Set();
    while (出过.size < 集合.length) {
      // 找第一个「前驱已经出过（或没有前驱）」的块
      let 下一个 = 按位置排.find(b =>
        !出过.has(b.id) && (!前驱表.has(b.id) || 出过.has(前驱表.get(b.id).id)));

      // 链条成环或指向不存在时兜底，避免死循环
      if (!下一个) 下一个 = 按位置排.find(b => !出过.has(b.id));
      if (!下一个) break;

      出过.add(下一个.id);
      出块(下一个, 深);
    }
  };

  const 出块 = (b, 深) => {
    const 定义 = 块定义[b.类型];
    if (!定义) return;
    const 缩进 = '    '.repeat(深);
    for (const 行内容 of 定义.模板(b)) 行.push(缩进 + 行内容);

    if (定义.可容纳) {
      行.push(缩进 + '{');
      走容器(b, 深 + 1);
      行.push(缩进 + '}');
    }
  };

  // 根：没有父的类
  const 根们 = 全部.filter(b => b.类型 === '类' && !b.父);
  if (根们.length) {
    有类 = true;
    行.push('使用 UnityEngine', '');
  }
  for (const 类 of 根们) 出块(类, 0);

  return 行.join('\n');
}

// ---- 孤岛检测 ----
// 只有一件事算孤岛：块没放进任何容器。
// 「放进托盘但没连线」不再算孤岛 —— 它照样会被生成，只是按左右位置排序。
// 归属决定生成不生成，连线只决定谁先谁后，两件事不能混。
function 找孤岛(块表) {
  return [...块表.values()]
    .filter(b => b.类型 !== '类' && !b.父)
    .map(b => ({ 块: b, 原因: '没放进任何容器' }));
}

const 出口 = { 生成中文, 找孤岛, 是容器 };

if (typeof window !== 'undefined') window.Canvas2 = 出口;
if (typeof module !== 'undefined') module.exports = 出口;

})();
