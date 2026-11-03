// 检查 editor2.html 里内联的脚本有没有语法错误（不执行，只解析）
const fs = require('fs');
const html = fs.readFileSync('D:/dswork/zh-csharp-lab/editor2.html', 'utf8');

// 取出所有没有 src 的 <script> 块
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, n = 0, 坏 = 0;
while ((m = re.exec(html))) {
  n++;
  const js = m[1];
  const 行 = html.slice(0, m.index).split('\n').length;
  try {
    new Function(js);          // 只解析，不运行
  } catch (e) {
    坏++;
    console.log(`✗ 第 ${行} 行开始的 <script> 有语法错误：${e.message}`);
    // 打印出错位置附近
    const 行们 = js.split('\n');
    const num = parseInt((e.stack || '').match(/<anonymous>:(\d+)/)?.[1] || '0', 10);
    if (num > 0) {
      for (let i = Math.max(0, num - 3); i < Math.min(行们.length, num + 2); i++) {
        console.log(`   ${i + 1}: ${行们[i]}`);
      }
    }
  }
}
console.log(n + ' 段脚本，' + (坏 ? 坏 + ' 段有问题' : '全部解析通过'));
process.exit(坏 ? 1 : 0);
