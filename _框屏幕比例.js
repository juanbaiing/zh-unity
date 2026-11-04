// 实例框（装着脚本的那个框）的长宽比改成屏幕比例。
//
// 为什么：框现在是正方形（260×220）。放大到占满屏幕之后，里面当编辑器用时
// 是一块方的画布，而屏幕是横的 —— 形状对不上，边上一大片浪费。
// 框做成屏幕的形状，放大铺满时内部画布就是一块正常的编辑区。
//
// 做法：不写死宽也不写死高，先让内容把框撑到该有的高度，再反过来定宽 ——
// 宽 = 高 × 屏幕比例。这样脚本多的框(内容高)就宽，脚本少的就窄，
// 长宽比始终跟着屏幕走。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');
const 前 = s;

// ── ① 建实例框结尾处：按内容高度反定宽度 ──
const 旧尾 = `  脚.textContent = 实.组件 || '';
  el.appendChild(脚);

  // 拖标题条移动整个框。用 pointer 事件，坐标除以视.z —— 和块用的是同一套换算。`;
const 新尾 = `  脚.textContent = 实.组件 || '';
  el.appendChild(脚);

  // 长宽比 = 屏幕比例。先让内容把高度撑出来，再反过来定宽：宽 = 高 × 比。
  // 这样脚本多的框自动宽、少的自动窄，形状始终跟着屏幕走；
  // 放大到占满屏幕时，里面那块画布就是一块正常的横的编辑区，不是方的。
  const 屏比 = (window.innerWidth || 1400) / (window.innerHeight || 900);
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const 高 = el.offsetHeight;
    const 宽 = Math.round(Math.max(240, 高 * 屏比));
    el.style.width = 宽 + 'px';
  });

  // 拖标题条移动整个框。用 pointer 事件，坐标除以视.z —— 和块用的是同一套换算。`;
if (!s.includes(旧尾)) { console.error('❌ 建实例框尾部没匹配'); process.exit(1); }
s = s.replace(旧尾, 新尾);

// ── ② 实例框样式：宽度交给 JS，去掉会抢宽度的 min-width 影响 ──
s = s.replace(
  '.实例框{position:absolute;background:var(--panel);border:1px solid var(--line);\n    border-radius:8px;min-width:200px;z-index:1}',
  `/* 宽度由 JS 按「高 × 屏幕比例」定，这里不写死 —— 写死就跟长宽比打架 */\n  .实例框{position:absolute;background:var(--panel);border:1px solid var(--line);\n    border-radius:8px;min-width:240px;box-sizing:border-box;z-index:1}`
);

// ── ③ 画网时统一算一遍（窗口尺寸变了要跟着变）──
s = s.replace(
  '  画线();\n  自动扩画布();',
  `  // 窗口尺寸可能变过，重算一遍长宽比
  窗口改了就重排();
  画线();
  自动扩画布();`
);

// ── ④ 新函数：按新的屏幕比例重排所有实例框的宽度 ──
s = s.replace(
  'function 建实例框(实) {',
  `// 窗口尺寸变了，所有框的宽度都跟着屏幕比例重算。
// 长宽比是「跟着屏幕走」的，不是建的时候算一次就完事。
function 窗口改了就重排() {
  const 比 = (window.innerWidth || 1400) / (window.innerHeight || 900);
  for (const el of document.querySelectorAll('.实例框')) {
    const 高 = el.offsetHeight;
    if (!高) continue;
    el.style.width = Math.round(Math.max(240, 高 * 比)) + 'px';
  }
}

function 建实例框(实) {`
);

if (s === 前) { console.error('❌ 什么都没改'); process.exit(1); }
fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('实例框长宽比改成屏幕比例');
