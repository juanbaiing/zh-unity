(function () {

// ============================================================
// 树模型：块可以装块
//
//   {
//     id, 类型,
//     字段: { 名: 值, ... },
//     子:   [块, ...],                       // 内容（垂直排列，按顺序生成）
//     分支: [{ 字段: {...}, 子: [块...] }],   // 只有 if 类用：否则若 / 否则
//   }
//
// 为什么换成树：
//   原来三个独立块靠「后链 + 坐标」拼成一条 if，
//   于是出现了：拖散、一段长高盖住下一段、松手归属判错、无限撑大……
//   树模型里 if 就是一块，里面的段是它自己的身体，不存在「拼」。
// ============================================================

const 块定义 = (typeof window !== 'undefined' && window.Blocks)
  ? window.Blocks.块定义
  : require('./blocks.js').块定义;

let 序号 = 0;

function 新(类型, 字段 = {}) {
  const 定义 = 块定义[类型];
  if (!定义) throw new Error('未知块类型：' + 类型);

  const b = {
    id: ++序号,
    类型,
    字段: {},
    子: [],
    分支: [],
    x: 0, y: 0,      // 只有在画布顶层时才用（自由摆放）
  };
  (定义.字段 || []).forEach(f => {
    b.字段[f.k] = (f.k in 字段) ? 字段[f.k] : (f.默认 ?? '');
  });
  return b;
}

// if 链专用：加一段分支。终结=true 表示「否则」
function 加分支(块, 字段 = {}, 终结 = false) {
  块.分支.push({ 字段, 子: [], 终结 });
  return 块.分支[块.分支.length - 1];
}

// ---------------- 生成顺序 ----------------
// 不是单纯「谁在上面谁先」——那样横向摆开就白摆了。
// 改成：把垂直方向上重叠的块算作同一行，行内从左到右读，行与行之间从上到下。
// 这样你可以把几条不相干的语句并排摆着，不用一根线。
function 按行读(子们) {
  const 排好 = [...子们].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
  const 行 = [];
  let 当前 = null;
  for (const b of 排好) {
    const 顶 = b.y || 0;
    const 高 = b._h || (b.子 && b.子.length ? 100 : 32);
    if (当前 && 顶 < 当前.底) {
      当前.们.push(b);
      当前.底 = Math.max(当前.底, 顶 + 高);
    } else {
      当前 = { 顶, 底: 顶 + 高, 们: [b] };
      行.push(当前);
    }
  }
  return 行.flatMap(r => r.们.sort((p, q) => (p.x || 0) - (q.x || 0)));
}

// ---------------- 生成 ----------------
// 返回中文套式源码（后续交给 zh2unity 翻成 C#）
function 生成(根块们) {
  const 行 = [];

  const 有类 = 根块们.some(b => b.类型 === '类');

  // 某些块必须补 using，不然编译不过 —— 与其让人记，不如自动加
  const 用到 = (类型名) => {
    let 有 = false;
    (function 找(列表) {
      for (const b of 列表) {
        if (b.类型 === 类型名) 有 = true;
        找(b.子 || []);
        for (const 段 of b.分支 || []) 找(段.子 || []);
      }
    })(根块们);
    return 有;
  };

  // 把每块里填的内容都收成一串 —— 用到了 UI / AI 的类型名，就得补对应的 using，
  // 不然「明明代码没错」却编译不过，是新手最容易卡住的一种。
  const 词们 = [];
  (function 收(列表) {
    for (const b of 列表) {
      for (const v of Object.values(b.字段 || {})) 词们.push(String(v));
      收(b.子 || []);
      for (const 段 of b.分支 || []) 收(段.子 || []);
    }
  })(根块们);
  const 词串 = 词们.join(' ');

  const 词们小 = 词串.toLowerCase();
  const 要UI = /text|image|button|slider|toggle|rawimage/.test(词们小);
  const 要AI = /(NavMesh|navAgent|navMeshAgent)/i.test(词串);

  const 头 = [];
  if (有类) 头.push('使用 UnityEngine');
  if (用到('切换场景')) 头.push('使用 UnityEngine.SceneManagement');
  if (要UI) 头.push('使用 UnityEngine.UI');
  if (要AI) 头.push('使用 UnityEngine.AI');
  if (头.length) 行.push(...头, '');

  const 取值 = b => ({ ...b.字段, 类型: b.类型 });

  const 走块 = (b, 深, 父) => {
    const 定义 = 块定义[b.类型];
    if (!定义) return;

    const 缩进 = '    '.repeat(深);
    for (const 行内容 of 定义.模板(取值(b))) 行.push(缩进 + 行内容);

    if (!定义.可容纳) return;

    // 容器里的块可以随便摆，生成时按「从上到下」排 —— 跟你在画布上看到的一致
    const 子们 = 按行读(b.子 || []);

    行.push(缩进 + '{');
    for (const 子 of 子们) 走块(子, 深 + 1, b);

    // C# 要求 case 能脱离开关，否则 CS0163 / CS8070。
    // blocks.js 里早就补了这一句，blocks2 这条生成路径漏了 —— 同一个坑两条路，只修了一条。
    if (父 && 父.类型 === '多分支' && (b.类型 === '遇' || b.类型 === '其他')) {
      const 最后 = 子们[子们.length - 1];
      if (!最后 || (最后.类型 !== '跳出' && 最后.类型 !== '返回' && 最后.类型 !== '继续')) {
        行.push('    '.repeat(深 + 1) + '跳出');
      }
    }

    行.push(缩进 + '}');

    // 后续分支（否则若 / 否则）
    for (const 段 of b.分支) {
      const 段取值 = { ...段.字段, 类型: b.类型 };
      const 标题 = 段.终结 ? ['否则'] : 块定义['否则若'].模板(段取值);
      for (const 行内容 of 标题) 行.push(缩进 + 行内容);

      const 段子们 = 按行读(段.子 || []);
      行.push(缩进 + '{');
      for (const 子 of 段子们) 走块(子, 深 + 1, b);
      行.push(缩进 + '}');
    }
  };

  const 走一串 = (块们, 深) => {
    for (const b of 块们) 走块(b, 深, null);
  };

  走一串(根块们, 0);
  return 行.join('\n');
}

// 树 → C#
function 生成CSharp(根块们) {
  const 中文 = 生成(根块们);
  const 译 = (typeof window !== 'undefined' && window.Zh2Unity)
    ? window.Zh2Unity.译脚本
    : require('./zh2unity.js').译脚本;
  return 译(中文);
}

// ---------------- 增删查 ----------------
// 在树里按 id 找父容器（返回 {列表, 下标}）
function 找位置(根块们, id) {
  const 递归 = (列表, 父) => {
    for (let i = 0; i < 列表.length; i++) {
      if (列表[i].id === id) return { 列表, 下标: i, 块: 列表[i], 父 };
      const r = 递归(列表[i].子, 列表[i]);
      if (r) return r;
      for (const 段 of 列表[i].分支) {
        const r2 = 递归(段.子, 列表[i]);
        if (r2) return r2;
      }
    }
    return null;
  };
  return 递归(根块们, null);
}

function 删(根块们, id) {
  const 位 = 找位置(根块们, id);
  if (!位) return false;
  位.列表.splice(位.下标, 1);
  return true;
}

function 上移(根块们, id) {
  const 位 = 找位置(根块们, id);
  if (!位 || 位.下标 === 0) return false;
  const 列 = 位.列表;
  [列[位.下标 - 1], 列[位.下标]] = [列[位.下标], 列[位.下标 - 1]];
  return true;
}

function 下移(根块们, id) {
  const 位 = 找位置(根块们, id);
  if (!位 || 位.下标 === 位.列表.length - 1) return false;
  const 列 = 位.列表;
  [列[位.下标 + 1], 列[位.下标]] = [列[位.下标], 列[位.下标 + 1]];
  return true;
}

// 把块从树上摘下来（返回块本身，找不到就 null）
function 摘(根块们, id) {
  const 位 = 找位置(根块们, id);
  if (!位) return null;
  位.列表.splice(位.下标, 1);
  return 位.块;
}

const 出口 = {
  新, 加分支, 生成, 生成CSharp, 按行读,
  找位置, 删, 上移, 下移, 摘,
  块定义,
};

if (typeof window !== 'undefined') window.树 = 出口;
if (typeof module !== 'undefined') module.exports = 出口;

})();
