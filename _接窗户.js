// 把块拖拽的坐标换算补上「窗户内层缩放」，并把滚轮绑到窗户上。
//
// ⚠️ editor2.html 是 CRLF。多行 old_string 直接比会全不中 —— 读进来先归一，写完再换回去。
const fs = require('fs');
const p = 'D:/dswork/zh-csharp-lab/editor2.html';
const 原件 = fs.readFileSync(p, 'utf8');
const 是CRLF = 原件.includes('\r\n');
let s = 原件.replace(/\r\n/g, '\n');
const 前 = s;

// ── ① 两个辅助函数 ──
const 锚 = 'function 开始拖(b, el, 起始) {';
if (!s.includes(锚)) { console.error('锚没找到'); process.exit(1); }
if (!s.includes('function 总缩放()')) {
  s = s.replace(锚, [
    '// 块画在哪个容器、那个容器在屏幕上放大多少倍。',
    '// 平时是 #world（放大 视.z）；开了窗户是 内世界（再乘一层 内视.z）。',
    '// 拖拽拿到的都是**屏幕**坐标，换回画布坐标必须除以这个总倍率 ——',
    '// 上一次移植就是漏了这一层，块一拖就飞出去。',
    'function 块容器() { return 当前画布 || 世界; }',
    'function 总缩放() { return (视.z || 1) * (当前画布 && 窗.内 ? (窗.内视.z || 1) : 1); }',
    '',
    锚,
  ].join('\n'));
  console.log('加了 块容器() / 总缩放()');
}

// ── ② 各处「/ 视.z」换成「/ 总缩放()」，基准矩形换成块容器 ──
const 换 = [
  ['const wr0 = 世界.getBoundingClientRect();', 'const wr0 = 块容器().getBoundingClientRect();'],
  ['b.x = (起始rect.left - wr0.left) / 视.z;', 'b.x = (起始rect.left - wr0.left) / 总缩放();'],
  ['b.y = (起始rect.top - wr0.top) / 视.z;', 'b.y = (起始rect.top - wr0.top) / 总缩放();'],
  ['b.x = (ev.clientX - wx.left - 抓x) / 视.z;', 'b.x = (ev.clientX - wx.left - 抓x) / 总缩放();'],
  ['b.y = (ev.clientY - wx.top - 抓y) / 视.z;', 'b.y = (ev.clientY - wx.top - 抓y) / 总缩放();'],
  ['b.x = Math.max(4, b.x - (盒rect.left - 世界rect.left) / 视.z);',
   'b.x = Math.max(4, b.x - (盒rect.left - 世界rect.left) / 总缩放());'],
  ['b.y = Math.max(4, b.y - (盒rect.top - 世界rect.top) / 视.z);',
   'b.y = Math.max(4, b.y - (盒rect.top - 世界rect.top) / 总缩放());'],
  ['块.x = 块.x + ((cx - 落点偏移x) - r0.left) / 视.z;',
   '块.x = 块.x + ((cx - 落点偏移x) - r0.left) / 总缩放();'],
  ['块.y = 块.y + ((cy - 落点偏移y) - r0.top) / 视.z;',
   '块.y = 块.y + ((cy - 落点偏移y) - r0.top) / 总缩放();'],
];
let 数 = 0;
for (const [旧, 新] of 换) {
  if (!s.includes(旧)) { console.log('  ⚠ 没有：' + 旧.slice(0, 46)); continue; }
  s = s.replace(旧, 新);
  数++;
}
if (s.includes('scale(${视.z})')) {
  s = s.split('scale(${视.z})').join('scale(${总缩放()})');
  数++;
  console.log('  拖动浮层 scale(视.z) → scale(总缩放())');
}

// ── ③ 滚轮绑到窗户上 ──
const 起 = s.indexOf('function 装窗缩放() {');
if (起 < 0) { console.error('装窗缩放 没找到'); process.exit(1); }
const 终 = s.indexOf('\n}\n', 起);
if (终 < 0) { console.error('装窗缩放 结尾没找到'); process.exit(1); }
const 新滚 = [
  'function 装窗缩放() {',
  '  const 框 = 窗.el;',
  '  if (!框 || 框._绑了) return;',
  '  框._绑了 = true;',
  '  框.addEventListener(\'wheel\', e => {',
  '    // 窗户里滚 = 缩窗户里的世界。stopPropagation 挡住外层那张网 ——',
  '    // 不挡的话一滚两层一起动，谁也控制不了。',
  '    e.preventDefault();',
  '    e.stopPropagation();',
  '    const r = 框.getBoundingClientRect();',
  '    const 旧z = 窗.内视.z || 1;',
  '    const 新z = Math.min(4, Math.max(0.15, 旧z * (e.deltaY > 0 ? 0.9 : 1.1)));',
  '    // 以光标为中心：光标底下那个点，缩放前后停在原地',
  '    const lx = (e.clientX - r.left - 窗.内视.x) / 旧z;',
  '    const ly = (e.clientY - r.top - 窗.内视.y) / 旧z;',
  '    窗.内视.x = e.clientX - r.left - lx * 新z;',
  '    窗.内视.y = e.clientY - r.top - ly * 新z;',
  '    窗.内视.z = 新z;',
  '    应用内视();',
  '  }, { passive: false });',
  '}',
  '',
].join('\n');
s = s.slice(0, 起) + 新滚 + s.slice(终 + 3);
console.log('  滚轮重绑到 .窗户');

if (s === 前) { console.error('什么都没改'); process.exit(1); }
fs.writeFileSync(p, 是CRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log(`坐标换算 ${数} 处`);
