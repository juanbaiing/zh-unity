// 把「窗户里的真块」那套样式，改回原设计（unity-graph-lab 第五版，commit 2cbca43）的配色语言。
//
// 原设计只有三条，是当时定下来的，不是随手配的：
//   1. 颜色必须编码含义 —— 整张图只剩两种有颜色的东西：
//      脚本（青灰蓝，表示"行为"）和数据（暗绿，表示"值"）。
//      其余的线、框、字，全部是灰阶。灰阶不抢注意力，只分层。
//   2. 装饰不带信息就删 —— 数据槽的方框全拆了，改成一条细下划线。
//   3. 对比用在结构上 —— 框边亮一点浮出背景，正文压暗，最亮那点留给连线。
//
// 而「搬过来的那套」把三条全踩了：
//   方框 + 左边 3px 色条 + 圆角底色（第 2 条要删的就是这个）
//   #7ee787 荧光绿 + #5a3f8a 紫（第 1 条说只剩两种颜色，且都该暗）
//   块底 #171c25 在实例框 #151a21 里几乎没差（第 3 条）
const fs = require('fs');

const 新块 = `  /* ---- 窗口里的真块 ----
     照原设计（unity-graph-lab 第五版）那三条来，不是随手配的：
       ① 颜色只编码含义 —— 脚本青灰蓝、数据暗绿，其余全灰阶
       ② 装饰不带信息就删 —— 块本身没有底色、没有边框、没有圆角底色；
          值用一条细下划线，输入框的方框全拆了
       ③ 对比用在结构上 —— 正文压暗，最亮那一点留给连线
     原来那套是从块编辑器直接搬来的：方框 + 左边 3px 色条 + #7ee787 荧光绿 + #5a3f8a 紫。
     在编辑器里那是块，在这里它是图上的内容 —— 换个场景就得换一套克制的语言。 */
  .窗块{position:relative;padding:1px 0;margin:0 0 3px 0;
    font:12.5px "Cascadia Code",Consolas,monospace;color:#a9b4c2;white-space:nowrap}
  .窗块 .头{display:flex;align-items:center;gap:6px;padding:2px 3px;
    cursor:move;user-select:none;flex-wrap:nowrap;border-radius:3px}
  .窗块 .头:hover{background:#151a21}
  .窗块 .号{font-size:9.5px;color:#39434f;min-width:13px;text-align:right;user-select:none}
  .窗块 .类{font-size:10px;color:#5d6b7d}
  .窗块 .填{color:#5f9e7a;border:0;border-bottom:1px solid transparent;border-radius:0;
    padding:0 2px;outline:none;background:none;
    font:11.5px "Cascadia Code",Consolas,monospace;height:19px;line-height:19px;cursor:text}
  .窗块 .填:hover{border-bottom-color:#28313d}
  .窗块 .填:focus{border-bottom-color:#5f9e7a}
  .窗块 .填::placeholder{color:#39434f}
  .窗块 .钮{color:#4b5d72;cursor:pointer;padding:0 4px;user-select:none;font-size:11px}
  .窗块 .钮:hover{color:#c8d2de}
  /* 容器块：一条细竖线说明「这些在它里面」—— 这是结构，不是装饰 */
  .窗块 .体{margin:1px 0 1px 15px;padding-left:9px;
    border-left:1px solid #242c37;min-height:18px}
  .窗块 .体:empty::after{content:'空';color:#39434f;font-size:10.5px}
`;

for (const p of ['D:/dswork/zh-csharp-lab/数据层/图模板.html', 'D:/dswork/unity-graph-lab/实例图.html']) {
  const 原件 = fs.readFileSync(p, 'utf8');
  const 是CRLF = 原件.includes('\r\n');
  let s = 原件.replace(/\r\n/g, '\n');

  // 从注释头切到 .体:empty::after 那行结束
  const 起 = s.indexOf('  /* ---- 窗口里的真块');
  if (起 < 0) { console.log(`⚠ ${p}：没找到那一段，跳过`); continue; }
  const 尾标 = "content:'拖块进来';color:#39424f;font-size:11px}";
  const 尾 = s.indexOf(尾标, 起);
  if (尾 < 0) { console.log(`⚠ ${p}：没找到结尾标记，跳过`); continue; }
  const 终 = 尾 + 尾标.length + 1;   // 吃掉换行

  s = s.slice(0, 起) + 新块 + s.slice(终);
  fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');

  // 自检：原来那套色必须一个不剩
  const 后 = fs.readFileSync(p, 'utf8');
  const 遗留 = ['#7ee787', '#5a3f8a', '#171c25', '#141922', '#1f2632', '#12161d', '#0d1117', '#10151c', '#3a4757', '#c9d4e3', '#6b7688', '#5a6478', '#4a5568']
    .filter(x => 后.includes(x));
  console.log(`${遗留.length ? '✗' : '✓'} ${p.split('/').pop()}  残留旧色：${遗留.join(' ') || '无'}`);
}
