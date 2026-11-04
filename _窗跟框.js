// 把窗户改成「那个脚本框的窗口」，而不是「固定在屏幕中央的一块板」。
//
// 上一轮我做成 fixed + 舞台居中 92%×88% —— 那等于盖死了网，
// 跟你确认过的「网还在那」直接冲突。
//
// 正确做法：窗户从脚本框的屏幕位置出发，往右下铺到舞台边缘；
// 但**钳在舞台里面**，绝不越界 —— 越出去就是「放大后窗口不见了」。
// 再加一条标题条，挡着网可以拖走。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');
const 前 = s;

// ── ① CSS：加标题条 ──
const 旧CSS = `  .窗户{position:fixed;background:var(--槽);
    border:1px solid var(--line);border-radius:8px;overflow:hidden;z-index:20;
    box-shadow:0 8px 40px rgba(0,0,0,.5)}`;
const 新CSS = `  .窗户{position:fixed;background:var(--槽);
    border:1px solid var(--line);border-radius:8px;overflow:hidden;z-index:20;
    box-shadow:0 8px 40px rgba(0,0,0,.5)}
  .窗头{display:flex;align-items:center;justify-content:space-between;gap:8px;
    padding:6px 12px;cursor:move;user-select:none;white-space:nowrap;
    background:var(--panel);border-bottom:1px solid var(--line);
    color:#6f8aa3;font-size:var(--字标)}
  .窗头 b{color:var(--字1);font-weight:normal;font-size:var(--字正文)}
  .窗头 .关{cursor:pointer;color:var(--字4);padding:0 4px}
  .窗头 .关:hover{color:var(--bad)}`;
if (!s.includes(旧CSS)) { console.error('❌ CSS 没匹配'); process.exit(1); }
s = s.replace(旧CSS, 新CSS);

// ── ② 定位：从脚本框出发往右下铺，钳在舞台里 ──
const 旧尺 = `  // 尺寸按**屏幕像素**给，不除外层缩放 —— 窗户已经不在 #world 里了，
  // 外层怎么缩都影响不到它。铺满舞台 92%×88%，周围留着网。
  const 台 = 舞台.getBoundingClientRect();
  const 宽 = Math.round(台.width * 0.92), 高 = Math.round(台.height * 0.88);
  w.style.width = 宽 + 'px';
  w.style.height = 高 + 'px';
  w.style.left = Math.round(台.left + (台.width - 宽) / 2) + 'px';
  w.style.top = Math.round(台.top + (台.height - 高) / 2) + 'px';`;
const 新尺 = `  // 窗户是**这个脚本框的窗口**：从脚本框的位置出发，往右下铺到舞台边缘。
  // 但必须钳在舞台里面 —— 脚本框放大后会跑到视口外，照抄它的坐标
  // 窗户就跟着不见了（这就是上一版「放大后窗口不显示」的来历）。
  // 也不能反过来铺满舞台：那样把网全盖住了，网就「不在那」了。
  const 台 = 舞台.getBoundingClientRect();
  const 框r = (框el || 实例el).getBoundingClientRect();
  const 最小宽 = 420, 最小高 = 320, 边 = 10;
  let 左 = Math.min(Math.max(框r.left, 台.left + 边), 台.right - 最小宽 - 边);
  let 上 = Math.min(Math.max(框r.top, 台.top + 边), 台.bottom - 最小高 - 边);
  左 = Math.max(台.left + 边, 左);
  上 = Math.max(台.top + 边, 上);
  w.style.left = Math.round(左) + 'px';
  w.style.top = Math.round(上) + 'px';
  w.style.width = Math.round(台.right - 左 - 边) + 'px';
  w.style.height = Math.round(台.bottom - 上 - 边) + 'px';`;
if (!s.includes(旧尺)) { console.error('❌ 尺寸段没匹配'); process.exit(1); }
s = s.replace(旧尺, 新尺);

// ── ③ 建标题条 + 关窗按钮 + 拖动 ──
const 旧挂 = `  // 挂到 body：窗户是浮在整个界面上的窗口，不是某个框里的子元素
  document.body.appendChild(w);`;
const 新挂 = `  // 标题条：写着这是哪个脚本的窗口；拖着它能挪开，挡着网的时候有用
  const 头 = document.createElement('div');
  头.className = '窗头';
  const 题 = document.createElement('span');
  题.innerHTML = '<b></b> <span class="哪"></span>';
  题.querySelector('b').textContent = 脚本名;
  题.querySelector('.哪').textContent = (实例el.querySelector('.实例名') || {}).textContent || '';
  const 关钮 = document.createElement('span');
  关钮.className = '关';
  关钮.textContent = '✕';
  关钮.title = '关掉这扇窗';
  关钮.addEventListener('click', e => { e.stopPropagation(); 关窗(); });
  头.appendChild(题); 头.appendChild(关钮);
  w.appendChild(头);
  头.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target === 关钮) return;
    e.preventDefault();
    const 起 = { x: e.clientX, y: e.clientY, ox: parseFloat(w.style.left), oy: parseFloat(w.style.top) };
    const 动 = ev => {
      w.style.left = Math.round(起.ox + ev.clientX - 起.x) + 'px';
      w.style.top = Math.round(起.oy + ev.clientY - 起.y) + 'px';
    };
    const 停 = () => { window.removeEventListener('pointermove', 动); window.removeEventListener('pointerup', 停); };
    window.addEventListener('pointermove', 动);
    window.addEventListener('pointerup', 停);
  });
  // 内世界从标题条下面开始算，别被压住
  内.style.top = '0px';

  // 挂到 body：窗户是浮在整个界面上的窗口，不是某个框里的子元素
  document.body.appendChild(w);`;
if (!s.includes(旧挂)) { console.error('❌ 挂载没匹配'); process.exit(1); }
s = s.replace(旧挂, 新挂);

// ── ④ 内世界避开标题条 ──
const 旧内 = `  .内世界{position:absolute;left:0;top:0;transform-origin:0 0;`;
const 新内 = `  .内世界{position:absolute;left:0;top:34px;transform-origin:0 0;`;
if (!s.includes(旧内)) { console.error('❌ 内世界 没匹配'); process.exit(1); }
s = s.replace(旧内, 新内);

fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('窗户改成「跟着脚本框、钳在舞台里、能拖」—— 4 处改完');
