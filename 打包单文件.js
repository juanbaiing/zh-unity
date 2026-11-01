// 把 editor2.html 和它引用的 5 个 js 合成一个「单文件」页面
// —— 双击就能用，不用带着一堆 js 到处走。改完源码跑一次这个就行。
const fs = require('fs');
const path = require('path');

const 源 = path.join(__dirname, 'editor2.html');
const 出 = path.join(__dirname, '中文编辑器.html');

let html = fs.readFileSync(源, 'utf8');

const 引用 = /<script src="([^"]+)"><\/script>/g;
let 换过 = 0;

html = html.replace(引用, (整段, 文件) => {
  const p = path.join(__dirname, 文件);
  if (!fs.existsSync(p)) {
    console.warn('找不到', 文件, '—— 原样保留');
    return 整段;
  }
  let js = fs.readFileSync(p, 'utf8');
  // 文件里如果出现 </script>，会提前把标签闭合掉
  if (/<\/script/i.test(js)) {
    js = js.replace(/<\/script/gi, '<\\/script');
    console.warn(文件, '里有 </script>，已转义');
  }
  换过++;
  return '<script>\n/* ===== ' + 文件 + ' ===== */\n' + js + '\n</script>';
});

fs.writeFileSync(出, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('内联了', 换过, '个脚本');
console.log('写出', 出, '→', kb(Buffer.byteLength(html, 'utf8')));
