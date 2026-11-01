// 检查：浏览器里同时加载这些脚本，挂到 window 上的名字是否冲突
// （每个文件已包 IIFE，内部作用域相互独立，只需看 window 上的出口）
const fs = require('fs');

const 文件们 = ['translator.js', 'unity-words.js', 'zh2unity.js'];
const 已挂 = new Map();
let 有冲突 = false;

for (const f of 文件们) {
  const 源 = fs.readFileSync(f, 'utf8');

  // 文件是否被 IIFE 包裹（作用域隔离）
  const 已隔离 = /^\s*\(function/.test(源);

  // 收集挂到 window 的名字（支持中文标识符）
  const 挂名 = new Set();
  for (const m of 源.matchAll(/window\.([\w$\u4e00-\u9fa5]+)\s*=/g)) 挂名.add(m[1]);

  if (!已隔离) {
    // 没隔离的话，顶层声明也进入全局，一并算
    for (const m of 源.matchAll(/^(?:const|let|var)\s+([A-Za-z_$\u4e00-\u9fa5][\w$\u4e00-\u9fa5]*)\s*=/gm)) 挂名.add(m[1]);
    for (const m of 源.matchAll(/^function\s+([A-Za-z_$\u4e00-\u9fa5][\w$\u4e00-\u9fa5]*)/gm)) 挂名.add(m[1]);
  }

  console.log(`${f}: ${已隔离 ? 'IIFE 隔离' : '⚠ 未隔离'} → ${[...挂名].join(', ') || '不挂任何名字'}`);

  for (const 名 of 挂名) {
    if (已挂.has(名)) {
      console.log(`  ❌ window.${名} 已被 ${已挂.get(名)} 占用`);
      有冲突 = true;
    } else {
      已挂.set(名, f);
    }
  }
}

if (有冲突) {
  console.log('\n有冲突：后加载的会覆盖前面');
  process.exit(1);
}
console.log('\n✅ 无冲突');
