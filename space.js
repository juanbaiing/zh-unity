(function () {

// ============================================================
// 空间模型：块只有坐标和图层，父子关系靠「谁框住谁」现算
//
//   块 = { id, 类型, 字段, x, y, z }
//
// 为什么父子不存起来：
//   存了就得维护，而维护会在拖动、嵌套、撑开时出错 ——
//   存的和看到的会不一致，于是出现拖散、盖住、归属紊乱。
//   现在改成：每次重绘量一遍矩形，按几何关系重新推导，
//   「看到什么就是什么」，不存在两套真相。
// ============================================================

const 块定义 = (typeof window !== 'undefined' && window.Blocks)
  ? window.Blocks.块定义
  : require('./blocks.js').块定义;

function 是容器(类型) {
  return !!(块定义[类型] && 块定义[类型].可容纳);
}

// ---- 推导父子 ----
// 矩形表: id -> { x, y, w, h }（页面坐标，同一坐标系）
// 规则：块的中心点落在某个容器矩形内 → 这个容器就是它的父；
//       多个容器都框住时，取面积最小的那个（最内层）。
//       图层 z 更高的块不会被下面的容器收走（"只有我盖在它上面才算"）。
function 推导(块们, 矩形表) {
  const 父表 = new Map();      // id -> 父 id | null

  for (const b of 块们) {
    const r = 矩形表.get(b.id);
    if (!r) { 父表.set(b.id, null); continue; }

    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    let 最佳 = null;
    let 最佳面积 = Infinity;

    for (const c of 块们) {
      if (c.id === b.id) continue;
      if (!是容器(c.类型)) continue;

      // 我必须在它上面（图层更高），否则就是它压着我，不算我进去
      if ((b.z || 0) <= (c.z || 0)) continue;

      const cr = 矩形表.get(c.id);
      if (!cr) continue;

      // 中心点要落在它框里
      if (cx < cr.x || cx > cr.x + cr.w) continue;
      if (cy < cr.y || cy > cr.y + cr.h) continue;

      const 面积 = cr.w * cr.h;
      if (面积 < 最佳面积) { 最佳面积 = 面积; 最佳 = c; }
    }

    父表.set(b.id, 最佳 ? 最佳.id : null);
  }

  return 父表;
}

// ---- 按推导结果生成 C#（中文 → zh2unity）----
function 生成(块们, 父表) {
  const 子表 = new Map();      // 父 id -> 子块数组
  const 根们 = [];

  // 保证顺序稳定：按 y 再按 x
  const 有序 = [...块们].sort((a, b) =>
    ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)));

  for (const b of 有序) {
    const p = 父表.get(b.id);
    if (p == null) { 根们.push(b); continue; }
    if (!子表.has(p)) 子表.set(p, []);
    子表.get(p).push(b);
  }

  const 行 = [];

  const 有类 = 根们.some(b => b.类型 === '类' && 父表.get(b.id) == null);
  if (有类) 行.push('使用 UnityEngine', '');

  const 取值 = b => ({ ...b.字段, 类型: b.类型 });

  const 走块 = (b, 深) => {
    const 定义 = 块定义[b.类型];
    if (!定义) return;

    const 缩进 = '    '.repeat(深);
    for (const 行内容 of 定义.模板(取值(b))) 行.push(缩进 + 行内容);

    if (!定义.可容纳) return;

    行.push(缩进 + '{');
    for (const 子 of (子表.get(b.id) || [])) 走块(子, 深 + 1);
    行.push(缩进 + '}');
  };

  // 只从「根上的类」开始生成。
  // 没进任何盒子、也不是类的孤岛块不生成 —— 它们会落在类外面，
  // 生成出来的 C# 直接是语法错误。界面会把这些标红提示。
  for (const b of 根们) {
    if (b.类型 === '类') 走块(b, 0);
  }

  return 行.join('\n');
}

function 生成CSharp(块们, 父表) {
  const 中文 = 生成(块们, 父表);
  if (!中文) return '';
  const 译 = (typeof window !== 'undefined' && window.Zh2Unity)
    ? window.Zh2Unity.译脚本
    : require('./zh2unity.js').译脚本;
  return 译(中文);
}

// ---- 孤岛：既不在任何容器里，也不是类 → 会落在根上，需要提示 ----
function 找孤岛(块们, 父表) {
  return 块们.filter(b => {
    const p = 父表.get(b.id);
    return p == null && b.类型 !== '类';
  });
}

const 出口 = { 推导, 生成, 生成CSharp, 找孤岛, 是容器, 块定义 };

if (typeof window !== 'undefined') window.空间 = 出口;
if (typeof module !== 'undefined') module.exports = 出口;

})();
