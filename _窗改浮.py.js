// 窗户改成浮在舞台中央，不再挂在实例框底下。
//
// 病根：.窗户 是 position:absolute; top:100%，挂在脚本框底部。
// 放大外层以后实例框变高，窗户被一路推到视口下面 —— 实测窗户在
// (361,553) 高 664，底边 1217，而视口只有 844，露出不到三百像素。
// 再放大就直接看不见了，看着像「窗口不显示了」。
//
// 改法：窗户 position:fixed，挂到 document.body（#world 上有 transform，
// fixed 在 transform 祖先里会退化成相对祖先定位，必须跳出那一层）。
// 尺寸按**屏幕像素**给，不除外层缩放；位置居中在舞台里。
// 这样不管外面怎么缩，窗户都稳稳占着舞台中间那一块，周围还能看见网。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');
const 前 = s;

// ── ① CSS ──
const 旧CSS = `  /* 窗户是浮出来的：逻辑上属于这个脚本框，但尺寸按屏幕给，会盖到框外面。 */
  .窗户{position:absolute;left:0;top:100%;margin-top:8px;background:var(--槽);
    border:1px solid var(--line);border-radius:8px;overflow:hidden;z-index:6}`;
const 新CSS = `  /* 窗户浮在舞台中央，不挂在实例框底下 ——
     挂在框底下的话，外层一放大，框变高，窗户就被推到视口外面去了。
     fixed + 挂 body：#world 上有 transform，fixed 在 transform 祖先里
     会退化成相对祖先定位，所以必须跳出那一层。 */
  .窗户{position:fixed;background:var(--槽);
    border:1px solid var(--line);border-radius:8px;overflow:hidden;z-index:20;
    box-shadow:0 8px 40px rgba(0,0,0,.5)}`;
if (!s.includes(旧CSS)) { console.error('❌ CSS 没匹配'); process.exit(1); }
s = s.replace(旧CSS, 新CSS);

// ── ② 总缩放：窗户不在 #world 里了，外层 视.z 不再作用于块 ──
const 旧缩 = 'function 总缩放() { return (视.z || 1) * (当前画布 && 窗.内 ? (窗.内视.z || 1) : 1); }';
const 新缩 = [
  '// 窗户不在 #world 里（它挂在 body 上是 fixed），所以外层 视.z 不作用在块上。',
  '// 块的有效缩放只有窗户自己那一层 内视.z。没开窗时才用外层的 视.z。',
  'function 总缩放() { return 当前画布 && 窗.内 ? (窗.内视.z || 1) : (视.z || 1); }',
].join('\n');
if (!s.includes(旧缩)) { console.error('❌ 总缩放 没匹配'); process.exit(1); }
s = s.replace(旧缩, 新缩);

// ── ③ 开窗：尺寸按屏幕像素、居中在舞台、挂到 body ──
const 旧尺 = `  // 按**屏幕比例**给尺寸，不按实例框那 183px。
  // 窗户要张大到铺满舞台，才叫「能当编辑器用」；嵌在实例框里缩到 0.2 倍
  // 还是看不清 —— 那等于没开。宽度除 视.z 是因为它长在 #world 里，
  // 屏幕上还要再乘一次外层缩放。
  const 外层z = 视.z || 1;
  w.style.width  = Math.round(Math.min(舞台.offsetWidth * 0.92 / 外层z, 1400)) + 'px';
  w.style.height = Math.round(Math.min(舞台.offsetHeight * 0.88 / 外层z, 900)) + 'px';`;
const 新尺 = `  // 尺寸按**屏幕像素**给，不除外层缩放 —— 窗户已经不在 #world 里了，
  // 外层怎么缩都影响不到它。铺满舞台 92%×88%，周围留着网。
  const 台 = 舞台.getBoundingClientRect();
  const 宽 = Math.round(台.width * 0.92), 高 = Math.round(台.height * 0.88);
  w.style.width = 宽 + 'px';
  w.style.height = 高 + 'px';
  w.style.left = Math.round(台.left + (台.width - 宽) / 2) + 'px';
  w.style.top = Math.round(台.top + (台.height - 高) / 2) + 'px';`;
if (!s.includes(旧尺)) { console.error('❌ 尺寸段没匹配'); process.exit(1); }
s = s.replace(旧尺, 新尺);

// ── ④ 挂到 body，不再挂进脚本框 ──
const 旧挂 = `  (框el || 实例el).appendChild(w);`;
const 新挂 = `  // 挂到 body：窗户是浮在整个界面上的窗口，不是某个框里的子元素
  document.body.appendChild(w);`;
if (!s.includes(旧挂)) { console.error('❌ 挂载没匹配'); process.exit(1); }
s = s.replace(旧挂, 新挂);

fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('窗户改成浮动窗口：4 处改完');
