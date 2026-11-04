// 提取 HTML 里的内联 <script>，做语法检查（没有浏览器时的替代验证）
const fs = require('fs');
const { execFileSync } = require('child_process');

const 文件 = process.argv[2] || 'editor2.html';
const html = fs.readFileSync(文件, 'utf8');

// 取所有内联脚本（没有 src 属性的）
const 脚本们 = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);

if (!脚本们.length) {
  console.log('没有内联脚本');
  process.exit(0);
}

console.log(`${文件}: 找到 ${脚本们.length} 段内联脚本`);
脚本们.forEach((源, i) => {
  const 临时 = `_check_${i}.js`;
  fs.writeFileSync(临时, 源, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', 临时], { stdio: 'pipe' });
    console.log(`  段 ${i + 1}: ✅ 语法正确`);
  } catch (e) {
    console.log(`  段 ${i + 1}: ❌ 语法错误`);
    console.log(String(e.stderr || e.message).split('\n').slice(0, 6).join('\n'));
  } finally {
    fs.unlinkSync(临时);
  }
});
